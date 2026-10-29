import { describe, it, expect } from "vitest";
import { parseUserMessage, extractAmount, inferCategory } from "../src/services/ai/ruleBasedParser";

describe("ruleBasedParser", () => {
  const refDate = new Date(2026, 9, 29); // 2026-10-29

  it("extracts amounts reliably across currencies and notations", () => {
    expect(extractAmount("₹65,000")).toBe(65000);
    expect(extractAmount("I spent ₹450 on dinner")).toBe(450);
    expect(extractAmount("Received Rs. 5,000 freelance")).toBe(5000);
    expect(extractAmount("$250.75")).toBe(250.75);
    expect(extractAmount("12,000")).toBe(12000);
    expect(extractAmount("Spent 200 on coffee")).toBe(200);
  });

  it("infers canonical categories from descriptions", () => {
    expect(inferCategory("dinner with family", "expense")).toBe("Food & Dining");
    expect(inferCategory("grocery shopping", "expense")).toBe("Groceries");
    expect(inferCategory("uber ride", "expense")).toBe("Transportation");
    expect(inferCategory("monthly salary", "income")).toBe("Salary");
    expect(inferCategory("freelance web dev project", "income")).toBe("Freelance");
  });

  it("parses: 'I got my salary today' -> income with missing amount", () => {
    const res = parseUserMessage("I got my salary today", refDate);
    expect(res.intent).toBe("record_transaction");
    if (res.intent === "record_transaction") {
      expect(res.draft.type).toBe("income");
      expect(res.draft.amount).toBeNull();
      expect(res.draft.category).toBe("Salary");
      expect(res.draft.transactionDate).toBe("2026-10-29");
      expect(res.draft.missingFields).toContain("amount");
    }
  });

  it("parses: 'I spent ₹450 on dinner yesterday' -> complete expense with yesterday date", () => {
    const res = parseUserMessage("I spent ₹450 on dinner yesterday", refDate);
    expect(res.intent).toBe("record_transaction");
    if (res.intent === "record_transaction") {
      expect(res.draft.type).toBe("expense");
      expect(res.draft.amount).toBe(450);
      expect(res.draft.category).toBe("Food & Dining");
      expect(res.draft.transactionDate).toBe("2026-10-28");
      expect(res.draft.missingFields.length).toBe(0);
    }
  });

  it("parses: 'I received ₹5,000 from a freelance project the day before yesterday'", () => {
    const res = parseUserMessage(
      "I received ₹5,000 from a freelance project the day before yesterday",
      refDate
    );
    expect(res.intent).toBe("record_transaction");
    if (res.intent === "record_transaction") {
      expect(res.draft.type).toBe("income");
      expect(res.draft.amount).toBe(5000);
      expect(res.draft.category).toBe("Freelance");
      expect(res.draft.transactionDate).toBe("2026-10-27");
      expect(res.draft.missingFields.length).toBe(0);
    }
  });

  it("parses: 'I spent 200 on coffee this morning' -> complete expense with today date", () => {
    const res = parseUserMessage("I spent 200 on coffee this morning", refDate);
    expect(res.intent).toBe("record_transaction");
    if (res.intent === "record_transaction") {
      expect(res.draft.type).toBe("expense");
      expect(res.draft.amount).toBe(200);
      expect(res.draft.category).toBe("Food & Dining");
      expect(res.draft.transactionDate).toBe("2026-10-29");
      expect(res.draft.missingFields.length).toBe(0);
    }
  });

  it("handles multi-turn follow-ups when awaiting amount or description", () => {
    // When awaiting amount: user enters "12,000"
    const resAmt = parseUserMessage("12,000", refDate, { isAwaitingAmount: true });
    expect(resAmt.intent).toBe("clarification_answer");
    if (resAmt.intent === "clarification_answer") {
      expect(resAmt.amount).toBe(12000);
    }

    // When awaiting description: user enters "Shopping"
    const resDesc = parseUserMessage("Shopping", refDate, { isAwaitingDescription: true });
    expect(resDesc.intent).toBe("clarification_answer");
    if (resDesc.intent === "clarification_answer") {
      expect(resDesc.description).toBe("Shopping");
      expect(resDesc.category).toBe("Shopping");
    }
  });

  it("identifies financial queries without creating transactions", () => {
    const q1 = parseUserMessage("How much did I spend today?", refDate);
    expect(q1.intent).toBe("financial_query");
    if (q1.intent === "financial_query") {
      expect(q1.queryType).toBe("spend_total");
      expect(q1.datePhrase).toBe("today");
    }

    const q2 = parseUserMessage("Compare this month's expenses with last month.", refDate);
    expect(q2.intent).toBe("financial_query");
    if (q2.intent === "financial_query") {
      expect(q2.queryType).toBe("compare_month");
    }

    const q3 = parseUserMessage("How much did I spend on food this month?", refDate);
    expect(q3.intent).toBe("financial_query");
    if (q3.intent === "financial_query") {
      expect(q3.queryType).toBe("category_spend");
      expect(q3.categoryFilter).toBe("Food & Dining");
    }

    const q4 = parseUserMessage("What is my biggest expense category?", refDate);
    expect(q4.intent).toBe("financial_query");
    if (q4.intent === "financial_query") {
      expect(q4.queryType).toBe("biggest_category");
    }
  });

  it("identifies corrections and deletions", () => {
    const c1 = parseUserMessage("Actually, it was ₹900", refDate);
    expect(c1.intent).toBe("correction");
    if (c1.intent === "correction") {
      expect(c1.field).toBe("amount");
      expect(c1.value).toBe(900);
    }

    const c2 = parseUserMessage("That was two days ago, not yesterday", refDate);
    expect(c2.intent).toBe("correction");
    if (c2.intent === "correction") {
      expect(c2.field).toBe("date");
      expect(c2.value).toBe("2026-10-27");
    }

    const d1 = parseUserMessage("Delete the transaction I just added", refDate);
    expect(d1.intent).toBe("deletion");
  });
});

