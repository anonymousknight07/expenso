import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing services
vi.mock("../src/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from "../src/lib/supabase";
import {
  getFinancialSummary,
  compareWithLastMonth,
  getCategorySpend,
} from "../src/services/financialQueryService";
import { DateRangeResult } from "../src/services/dateService";

describe("financialQueryService", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const mockRange: DateRangeResult = {
    startDateStr: "2026-10-01",
    endDateStr: "2026-10-31",
    label: "This Month",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates totals, net cash flow, savings rate, and category breakdown correctly", async () => {
    const mockExpenses = [
      {
        id: "e1",
        amount: 450,
        description: "Dinner",
        date: "2026-10-28",
        expense_category_mappings: [{ expense_categories: { name: "Food & Dining", color: "#f59e0b" } }],
      },
      {
        id: "e2",
        amount: 250,
        description: "Groceries",
        date: "2026-10-27",
        expense_category_mappings: [{ expense_categories: { name: "Groceries", color: "#10b981" } }],
      },
      {
        id: "e3",
        amount: 300,
        description: "Lunch",
        date: "2026-10-25",
        expense_category_mappings: [{ expense_categories: { name: "Food & Dining", color: "#f59e0b" } }],
      },
    ];

    const mockIncome = [
      {
        id: "i1",
        amount: 50000,
        in_hand_amount: 50000,
        description: "Salary",
        date: "2026-10-01",
        category: { name: "Salary" },
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "expenses") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => Promise.resolve({ data: mockExpenses, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "income") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => Promise.resolve({ data: mockIncome, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    });

    const summary = await getFinancialSummary(userId, mockRange);

    // Total expenses = 450 + 250 + 300 = 1000
    expect(summary.totalExpenses).toBe(1000);
    // Total income = 50000
    expect(summary.totalIncome).toBe(50000);
    // Net cash flow = 50000 - 1000 = 49000
    expect(summary.netCashFlow).toBe(49000);
    // Savings rate = (49000 / 50000) * 100 = 98%
    expect(summary.savingsRate).toBe(98);

    // Food & Dining = 450 + 300 = 750 (75%)
    // Groceries = 250 (25%)
    expect(summary.biggestCategory?.category).toBe("Food & Dining");
    expect(summary.biggestCategory?.amount).toBe(750);
    expect(summary.biggestCategory?.percentage).toBe(75);
    expect(summary.categoryBreakdown.length).toBe(2);
  });

  it("calculates month-over-month comparison accurately", async () => {
    const refDate = new Date(2026, 9, 29); // Oct 29, 2026

    let callCount = 0;
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "expenses") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => {
                    callCount++;
                    if (callCount === 1) {
                      // Current month: 15,000
                      return Promise.resolve({
                        data: [{ id: "c1", amount: 15000, description: "Current Month", date: "2026-10-15", expense_category_mappings: [] }],
                        error: null,
                      });
                    } else {
                      // Previous month: 20,000
                      return Promise.resolve({
                        data: [{ id: "p1", amount: 20000, description: "Prev Month", date: "2026-09-15", expense_category_mappings: [] }],
                        error: null,
                      });
                    }
                  },
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    });

    const comparison = await compareWithLastMonth(userId, refDate);
    expect(comparison.currentExpense).toBe(15000);
    expect(comparison.previousExpense).toBe(20000);
    expect(comparison.difference).toBe(-5000);
    expect(comparison.percentageChange).toBe(25);
    expect(comparison.increased).toBe(false);
  });

  it("filters spend for a specific category keyword", async () => {
    const mockExpenses = [
      {
        id: "e1",
        amount: 450,
        description: "Dinner at Taj",
        date: "2026-10-28",
        expense_category_mappings: [{ expense_categories: { name: "Food & Dining" } }],
      },
      {
        id: "e2",
        amount: 1200,
        description: "Shoes",
        date: "2026-10-20",
        expense_category_mappings: [{ expense_categories: { name: "Shopping" } }],
      },
      {
        id: "e3",
        amount: 200,
        description: "Coffee at Starbucks",
        date: "2026-10-29",
        expense_category_mappings: [{ expense_categories: { name: "Food & Dining" } }],
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "expenses") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => Promise.resolve({ data: mockExpenses, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    });

    const res = await getCategorySpend(userId, "food", mockRange);
    expect(res.totalSpent).toBe(650);
    expect(res.transactions.length).toBe(2);
  });
});
