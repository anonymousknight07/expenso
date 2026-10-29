import { parseRelativeDate, parseDateRange } from "../dateService";
import { TransactionDraft, TransactionType } from "../transactionService";

export type DetectedIntent =
  | "record_transaction"
  | "financial_query"
  | "correction"
  | "deletion"
  | "clarification_answer"
  | "general_chat";

export interface ParsedTransactionIntent {
  intent: "record_transaction";
  draft: TransactionDraft;
}

export interface ParsedFinancialQueryIntent {
  intent: "financial_query";
  queryType:
    | "spend_total"
    | "income_total"
    | "net_cash_flow"
    | "savings"
    | "compare_month"
    | "biggest_category"
    | "category_spend"
    | "list_transactions";
  datePhrase: string;
  categoryFilter?: string;
}

export interface ParsedCorrectionIntent {
  intent: "correction";
  field: "amount" | "date" | "category" | "description";
  value: any;
}

export interface ParsedDeletionIntent {
  intent: "deletion";
  target: "last_transaction" | "specific";
}

export interface ParsedClarificationIntent {
  intent: "clarification_answer";
  amount?: number;
  description?: string;
  category?: string;
  dateStr?: string;
}

export interface ParsedGeneralIntent {
  intent: "general_chat";
  response?: string;
}

export type ParseResult =
  | ParsedTransactionIntent
  | ParsedFinancialQueryIntent
  | ParsedCorrectionIntent
  | ParsedDeletionIntent
  | ParsedClarificationIntent
  | ParsedGeneralIntent;

// Category mappings by keyword
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Food & Dining": [
    "dinner",
    "lunch",
    "breakfast",
    "coffee",
    "cafe",
    "tea",
    "pizza",
    "burger",
    "zomato",
    "swiggy",
    "restaurant",
    "dining",
    "food",
    "snack",
    "snacks",
  ],
  Groceries: ["groceries", "grocery", "supermarket", "vegetables", "veggies", "milk", "fruits", "mart"],
  Transportation: [
    "uber",
    "ola",
    "taxi",
    "cab",
    "auto",
    "fuel",
    "petrol",
    "diesel",
    "metro",
    "bus",
    "train",
    "commute",
    "flight",
  ],
  Shopping: ["shopping", "clothes", "shoes", "shirt", "amazon", "flipkart", "myntra", "store"],
  Entertainment: ["movie", "cinema", "netflix", "spotify", "game", "steam", "concert", "entertainment"],
  "Bills & Utilities": ["rent", "electricity", "water", "wifi", "internet", "bill", "recharge", "gas"],
  Healthcare: ["medicine", "doctor", "pharmacy", "hospital", "clinic", "health"],
  Salary: ["salary", "paycheck", "wage", "stipend"],
  Freelance: ["freelance", "contract", "consulting", "side gig", "upwork", "fiverr", "client"],
  Investment: ["dividend", "interest", "stock", "crypto", "mutual fund"],
};

/**
 * Infer category from description text.
 */
export function inferCategory(text: string, type: TransactionType): string {
  const lower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return type === "income" ? "Income" : "General";
}

/**
 * Extracts a numeric amount from text (handles ₹, Rs, INR, $, commas).
 */
export function extractAmount(text: string): number | null {
  // 1. Matches formatted currency like ₹65,000, Rs. 450, $200, 5,000
  const currencyMatch = text.match(
    /(?:₹|rs\.?|inr|\$)\s*([\d,]+(?:\.\d+)?)/i
  );
  if (currencyMatch) {
    const raw = currencyMatch[1].replace(/,/g, "");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Matches "spent 450", "received 5000", "got 65000"
  const verbAmountMatch = text.match(
    /(?:spent|spend|paid|cost|received|got|earned|received|paid)\s+(?:about|approx|around)?\s*([\d,]+(?:\.\d+)?)/i
  );
  if (verbAmountMatch) {
    const raw = verbAmountMatch[1].replace(/,/g, "");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. Standalone number like "12,000" or "450" (often in multi-turn answers)
  const standaloneMatch = text.match(/^\s*(?:₹|rs\.?|\$)?\s*([\d,]+(?:\.\d+)?)\s*$/i);
  if (standaloneMatch) {
    const raw = standaloneMatch[1].replace(/,/g, "");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Any positive number in the string (fallback)
  const anyNumMatch = text.match(/\b(\d{2,}(?:,\d+)*(?:\.\d+)?)\b/);
  if (anyNumMatch) {
    const raw = anyNumMatch[1].replace(/,/g, "");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Main deterministic parser for natural language user messages.
 */
export function parseUserMessage(
  message: string,
  referenceDate: Date = new Date(),
  pendingContext?: {
    isAwaitingAmount?: boolean;
    isAwaitingDescription?: boolean;
    pendingDraft?: Partial<TransactionDraft>;
    lastCreatedTransactionId?: string;
  }
): ParseResult {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // -------------------------------------------------------------
  // 1. Deletion Intent
  // -------------------------------------------------------------
  if (
    lower.includes("delete the transaction") ||
    lower.includes("delete the last transaction") ||
    lower.includes("delete that") ||
    lower.includes("remove the transaction") ||
    lower.includes("delete transaction i just added") ||
    lower.includes("undo that transaction")
  ) {
    return {
      intent: "deletion",
      target: "last_transaction",
    };
  }

  // -------------------------------------------------------------
  // 2. Correction Intent ("Actually, it was ₹900", "Change that to entertainment", "That was two days ago, not yesterday")
  // -------------------------------------------------------------
  if (
    lower.startsWith("actually") ||
    lower.startsWith("no,") ||
    lower.includes("change that to") ||
    lower.includes("change category to") ||
    lower.includes("not yesterday") ||
    lower.includes("it was for")
  ) {
    // Check if correcting amount
    const amt = extractAmount(lower);
    if (amt !== null && (lower.includes("was") || lower.includes("actually") || lower.includes("make it"))) {
      return {
        intent: "correction",
        field: "amount",
        value: amt,
      };
    }

    // Check if correcting date
    const parsedDate = parseRelativeDate(lower, referenceDate);
    if (parsedDate && (lower.includes("ago") || lower.includes("was") || lower.includes("not"))) {
      return {
        intent: "correction",
        field: "date",
        value: parsedDate.dateStr,
      };
    }

    // Check if correcting category
    for (const [catName] of Object.entries(CATEGORY_KEYWORDS)) {
      if (lower.includes(catName.toLowerCase())) {
        return {
          intent: "correction",
          field: "category",
          value: catName,
        };
      }
    }

    // Check if correcting description
    const descMatch = lower.match(/(?:it was for|for)\s+([a-zA-Z\s]+)/);
    if (descMatch) {
      return {
        intent: "correction",
        field: "description",
        value: descMatch[1].trim(),
      };
    }
  }

  // -------------------------------------------------------------
  // 3. Multi-Turn Clarification Follow-up
  // If Penny was waiting for an amount or description
  // -------------------------------------------------------------
  if (pendingContext?.isAwaitingAmount) {
    const amt = extractAmount(lower);
    if (amt !== null) {
      return {
        intent: "clarification_answer",
        amount: amt,
      };
    }
  }

  if (pendingContext?.isAwaitingDescription) {
    // Single word or short phrase response like "Dinner", "Shopping", "Dinner with friends"
    if (trimmed.length > 0 && !lower.startsWith("how much")) {
      const cat = inferCategory(trimmed, "expense");
      return {
        intent: "clarification_answer",
        description: trimmed,
        category: cat,
      };
    }
  }

  // -------------------------------------------------------------
  // 4. Financial Query Intent (DO NOT CREATE TRANSACTIONS FOR QUERIES!)
  // -------------------------------------------------------------
  const isQuestion =
    lower.startsWith("how much") ||
    lower.startsWith("what is") ||
    lower.startsWith("what's") ||
    lower.startsWith("show me") ||
    lower.startsWith("compare") ||
    lower.includes("how much did i") ||
    lower.includes("how much have i") ||
    lower.includes("biggest expense") ||
    lower.includes("most spent");

  if (isQuestion) {
    // Compare periods
    if (lower.includes("compare") || (lower.includes("last month") && lower.includes("this month"))) {
      return {
        intent: "financial_query",
        queryType: "compare_month",
        datePhrase: "this month",
      };
    }

    // Biggest expense category
    if (
      lower.includes("biggest expense") ||
      lower.includes("highest expense") ||
      lower.includes("most spent") ||
      lower.includes("where did i spend most")
    ) {
      return {
        intent: "financial_query",
        queryType: "biggest_category",
        datePhrase: lower.includes("last month") ? "last month" : "this month",
      };
    }

    // Savings / Remaining balance query
    if (
      lower.includes("save") ||
      lower.includes("saved") ||
      lower.includes("left") ||
      lower.includes("money do i have left") ||
      lower.includes("net")
    ) {
      return {
        intent: "financial_query",
        queryType: "savings",
        datePhrase: lower.includes("last month") ? "last month" : "this month",
      };
    }

    // Income query
    if (
      lower.includes("earn") ||
      lower.includes("income") ||
      lower.includes("salary") ||
      lower.includes("receive")
    ) {
      return {
        intent: "financial_query",
        queryType: "income_total",
        datePhrase: lower.includes("today")
          ? "today"
          : lower.includes("last week")
          ? "last week"
          : lower.includes("last month")
          ? "last month"
          : "this month",
      };
    }

    // Category specific spend (e.g., "How much did I spend on food this month?")
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw)) || lower.includes(catName.toLowerCase())) {
        return {
          intent: "financial_query",
          queryType: "category_spend",
          datePhrase: lower.includes("today")
            ? "today"
            : lower.includes("yesterday")
            ? "yesterday"
            : lower.includes("last week")
            ? "last week"
            : lower.includes("last month")
            ? "last month"
            : "this month",
          categoryFilter: catName,
        };
      }
    }

    // General spend query ("How much did I spend today?")
    return {
      intent: "financial_query",
      queryType: "spend_total",
      datePhrase: lower.includes("today")
        ? "today"
        : lower.includes("yesterday")
        ? "yesterday"
        : lower.includes("last week")
        ? "last week"
        : lower.includes("last month")
        ? "last month"
        : "this month",
    };
  }

  // -------------------------------------------------------------
  // 5. Transaction Recording Intent (Income or Expense)
  // -------------------------------------------------------------
  const isIncome =
    lower.includes("salary") ||
    lower.includes("got paid") ||
    lower.includes("received") ||
    lower.includes("freelance") ||
    lower.includes("earned") ||
    lower.includes("dividend") ||
    lower.includes("bonus");

  const isExpense =
    lower.includes("spent") ||
    lower.includes("spend") ||
    lower.includes("bought") ||
    lower.includes("paid") ||
    lower.includes("ordered") ||
    lower.includes("cost");

  if (isIncome || isExpense) {
    const type: TransactionType = isIncome ? "income" : "expense";
    const amount = extractAmount(lower);

    // Resolve date deterministically using dateService
    const parsedDate = parseRelativeDate(lower, referenceDate);
    const dateStr = parsedDate ? parsedDate.dateStr : new Date(referenceDate).toISOString().split("T")[0];

    // Extract description & category
    let description: string | null = null;
    let category: string | null = null;

    if (type === "income") {
      if (lower.includes("salary")) {
        description = "Salary";
        category = "Salary";
      } else if (lower.includes("freelance")) {
        description = "Freelance Project";
        category = "Freelance";
      } else {
        // Try to find what it was for
        const forMatch = lower.match(/(?:for|from)\s+([a-zA-Z\s]+)/);
        description = forMatch ? forMatch[1].trim() : "Income";
        category = inferCategory(description, "income");
      }
    } else {
      // Expense description extraction: "spent 450 on dinner yesterday", "200 on coffee this morning"
      const onMatch = lower.match(/(?:on|for)\s+([a-zA-Z\s]+?)(?:\s+(?:today|yesterday|this morning|last night|the day before yesterday|\d+\s+days\s+ago|$))/i);
      if (onMatch) {
        description = onMatch[1].trim();
      } else {
        // Try keywords
        for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          const found = keywords.find((k) => lower.includes(k));
          if (found) {
            description = found.charAt(0).toUpperCase() + found.slice(1);
            category = catName;
            break;
          }
        }
      }

      if (description && !category) {
        category = inferCategory(description, "expense");
      }
    }

    const missingFields: ("amount" | "description" | "category" | "date")[] = [];
    if (amount === null) missingFields.push("amount");
    if (!description && type === "expense") missingFields.push("description");

    const draft: TransactionDraft = {
      type,
      amount,
      currency: "INR",
      description: description || (type === "income" ? "Income" : null),
      category: category || (type === "income" ? "Salary" : null),
      transactionDate: dateStr,
      confidence: 0.95,
      missingFields,
      requiresConfirmation: false,
    };

    return {
      intent: "record_transaction",
      draft,
    };
  }

  // -------------------------------------------------------------
  // 6. Standalone Amount or Short Form Message fallback
  // E.g., "₹450 on lunch" or "Coffee 200"
  // -------------------------------------------------------------
  const amt = extractAmount(lower);
  if (amt !== null) {
    const onMatch = lower.match(/(?:on|for)\s+([a-zA-Z\s]+)/i);
    const desc = onMatch ? onMatch[1].trim() : null;
    const cat = desc ? inferCategory(desc, "expense") : null;
    const parsedDate = parseRelativeDate(lower, referenceDate);
    const dateStr = parsedDate ? parsedDate.dateStr : new Date(referenceDate).toISOString().split("T")[0];

    const draft: TransactionDraft = {
      type: "expense",
      amount: amt,
      currency: "INR",
      description: desc,
      category: cat,
      transactionDate: dateStr,
      confidence: 0.8,
      missingFields: desc ? [] : ["description"],
      requiresConfirmation: false,
    };

    return {
      intent: "record_transaction",
      draft,
    };
  }

  // Default General Chat
  return {
    intent: "general_chat",
    response: "I'm Penny, your AI finance assistant. You can tell me what you spent or earned (e.g. 'I spent ₹450 on dinner yesterday') or ask financial questions (e.g. 'How much did I spend this month?').",
  };
}

