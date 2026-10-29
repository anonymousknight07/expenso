import { describe, it, expect, beforeEach, vi } from "vitest";
import { conversationManager } from "../src/services/conversationManager";
import * as txService from "../src/services/transactionService";
import * as finService from "../src/services/financialQueryService";

describe("conversationManager", () => {
  const userId = "test-user-123";
  const refDate = new Date(2026, 9, 29); // 2026-10-29

  beforeEach(() => {
    conversationManager.resetState();
    vi.restoreAllMocks();
  });

  it("handles multi-turn income flow: 'I got my salary today' -> Penny asks amount -> '₹65,000' -> persists", async () => {
    const mockCreate = vi.spyOn(txService, "createTransaction").mockResolvedValue({
      success: true,
      record: {
        id: "tx-income-1",
        type: "income",
        amount: 65000,
        description: "Salary",
        category: "Salary",
        date: "2026-10-29",
      },
    });

    // Turn 1: Incomplete income message
    const res1 = await conversationManager.handleMessage("I got my salary today", userId, "₹", refDate);
    expect(res1.isAwaitingInput).toBe(true);
    expect(res1.reply).toContain("How much salary did you receive?");
    expect(mockCreate).not.toHaveBeenCalled();

    // Turn 2: User provides amount "₹65,000"
    const res2 = await conversationManager.handleMessage("₹65,000", userId, "₹", refDate);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "income",
        amount: 65000,
        category: "Salary",
        transactionDate: "2026-10-29",
      }),
      userId,
      expect.any(String)
    );
    expect(res2.recordedTransaction?.amount).toBe(65000);
    expect(res2.reply).toContain("Done! I've recorded your ₹65,000");
  });

  it("handles multi-turn expense flow: 'I spent ₹800 yesterday' -> Penny asks description -> 'Shopping' -> persists with yesterday's date", async () => {
    const mockCreate = vi.spyOn(txService, "createTransaction").mockResolvedValue({
      success: true,
      record: {
        id: "tx-exp-1",
        type: "expense",
        amount: 800,
        description: "Shopping",
        category: "Shopping",
        date: "2026-10-28",
      },
    });

    // Turn 1: Expense with missing description
    const res1 = await conversationManager.handleMessage("I spent ₹800 yesterday", userId, "₹", refDate);
    expect(res1.isAwaitingInput).toBe(true);
    expect(res1.reply).toContain("What was the ₹800 for?");
    expect(mockCreate).not.toHaveBeenCalled();

    // Turn 2: User answers "Shopping"
    const res2 = await conversationManager.handleMessage("Shopping", userId, "₹", refDate);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "expense",
        amount: 800,
        description: "Shopping",
        category: "Shopping",
        transactionDate: "2026-10-28",
      }),
      userId,
      expect.any(String)
    );
    expect(res2.recordedTransaction?.date).toBe("2026-10-28");
    expect(res2.reply).toContain("Done! I've recorded ₹800 for Shopping on Yesterday under Shopping.");
  });

  it("handles single-turn complete message: 'I spent ₹450 on dinner yesterday'", async () => {
    const mockCreate = vi.spyOn(txService, "createTransaction").mockResolvedValue({
      success: true,
      record: {
        id: "tx-exp-2",
        type: "expense",
        amount: 450,
        description: "dinner",
        category: "Food & Dining",
        date: "2026-10-28",
      },
    });

    const res = await conversationManager.handleMessage(
      "I spent ₹450 on dinner yesterday",
      userId,
      "₹",
      refDate
    );
    expect(mockCreate).toHaveBeenCalled();
    expect(res.recordedTransaction?.amount).toBe(450);
    expect(res.recordedTransaction?.date).toBe("2026-10-28");
  });

  it("handles corrections: 'Actually, it was ₹900'", async () => {
    vi.spyOn(txService, "createTransaction").mockResolvedValue({
      success: true,
      record: {
        id: "tx-exp-3",
        type: "expense",
        amount: 800,
        description: "Shopping",
        category: "Shopping",
        date: "2026-10-28",
      },
    });

    const mockUpdate = vi.spyOn(txService, "updateTransaction").mockResolvedValue({
      success: true,
      record: {
        id: "tx-exp-3",
        type: "expense",
        amount: 900,
        description: "Shopping",
        category: "Shopping",
        date: "2026-10-28",
      },
    });

    // First record an expense
    await conversationManager.handleMessage("I spent ₹800 on shopping yesterday", userId, "₹", refDate);

    // Now correct it
    const res = await conversationManager.handleMessage("Actually, that was ₹900", userId, "₹", refDate);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "tx-exp-3", "expense", { amount: 900 });
    expect(res.updatedTransaction?.amount).toBe(900);
    expect(res.reply).toContain("updated the Shopping transaction amount to ₹900");
  });

  it("handles deletions: 'Delete the transaction I just added'", async () => {
    vi.spyOn(txService, "createTransaction").mockResolvedValue({
      success: true,
      record: {
        id: "tx-exp-4",
        type: "expense",
        amount: 450,
        description: "dinner",
        category: "Food & Dining",
        date: "2026-10-28",
      },
    });

    const mockDelete = vi.spyOn(txService, "deleteTransaction").mockResolvedValue({
      success: true,
    });

    // First record an expense
    await conversationManager.handleMessage("I spent ₹450 on dinner yesterday", userId, "₹", refDate);

    // Now delete it
    const res = await conversationManager.handleMessage("Delete the transaction I just added", userId, "₹", refDate);
    expect(mockDelete).toHaveBeenCalledWith(userId, "tx-exp-4", "expense");
    expect(res.deletedTransactionId).toBe("tx-exp-4");
    expect(res.reply).toContain("deleted the ₹450 dinner transaction");
  });

  it("answers financial questions using deterministic query service without creating transactions", async () => {
    const mockCreate = vi.spyOn(txService, "createTransaction");
    vi.spyOn(finService, "getFinancialSummary").mockResolvedValue({
      periodLabel: "Today",
      startDate: "2026-10-29",
      endDate: "2026-10-29",
      totalIncome: 0,
      totalExpenses: 450,
      netCashFlow: -450,
      savingsRate: 0,
      biggestCategory: { category: "Food & Dining", amount: 450, percentage: 100 },
      categoryBreakdown: [{ category: "Food & Dining", amount: 450, percentage: 100 }],
      expenseCount: 1,
      incomeCount: 0,
    });

    const res = await conversationManager.handleMessage("How much did I spend today?", userId, "₹", refDate);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.reply).toContain("spent **₹450** today");
  });
});

