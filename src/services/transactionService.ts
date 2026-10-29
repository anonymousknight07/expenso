import { supabase } from "../lib/supabase";

export type TransactionType = "income" | "expense";

export interface TransactionDraft {
  type: TransactionType;
  amount: number | null;
  currency: string;
  description: string | null;
  category: string | null;
  transactionDate: string | null; // YYYY-MM-DD
  confidence: number;
  missingFields: ("amount" | "description" | "category" | "date")[];
  requiresConfirmation: boolean;
  metadata?: Record<string, any>;
}

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  categoryId?: string;
  date: string; // YYYY-MM-DD
  createdAt?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// In-memory idempotency cache for recent operations (with TTL of 5 minutes)
const idempotencyStore = new Map<string, { record: TransactionRecord; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function cleanIdempotencyStore() {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

/**
 * Validates a transaction draft before attempting to persist it.
 */
export function validateTransactionDraft(draft: TransactionDraft): ValidationResult {
  const errors: string[] = [];

  if (draft.amount === null || draft.amount === undefined || isNaN(draft.amount) || draft.amount <= 0) {
    errors.push("A valid positive amount is required.");
  }

  if (draft.type !== "income" && draft.type !== "expense") {
    errors.push("Transaction type must be 'income' or 'expense'.");
  }

  if (!draft.transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(draft.transactionDate)) {
    errors.push("A valid transaction date in YYYY-MM-DD format is required.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Ensures an expense category exists for the user, matching case-insensitively or creating a new one.
 */
export async function ensureExpenseCategory(
  userId: string,
  categoryName: string
): Promise<{ id: string; name: string }> {
  const normalized = (categoryName || "General").trim();

  // Pick a nice color based on category keywords
  const colorMap: Record<string, string> = {
    food: "#f59e0b",
    dining: "#f59e0b",
    grocery: "#10b981",
    groceries: "#10b981",
    transport: "#3b82f6",
    travel: "#3b82f6",
    shopping: "#ec4899",
    entertainment: "#8b5cf6",
    bills: "#ef4444",
    utilities: "#f97316",
    health: "#06b6d4",
    education: "#6366f1",
  };

  const lower = normalized.toLowerCase();
  const matchedKey = Object.keys(colorMap).find((k) => lower.includes(k));
  const chosenColor = matchedKey ? colorMap[matchedKey] : "#64748b";

  try {
    // 1. Try to find existing category for this user
    const { data: existing, error: searchErr } = await supabase
      .from("expense_categories")
      .select("id, name")
      .eq("user_id", userId)
      .ilike("name", normalized)
      .maybeSingle();

    if (!searchErr && existing) {
      return { id: existing.id, name: existing.name };
    }

    // 2. Create category
    const { data: created, error: createErr } = await supabase
      .from("expense_categories")
      .insert([
        {
          name: normalized,
          color: chosenColor,
          user_id: userId,
        },
      ])
      .select("id, name")
      .single();

    if (createErr || !created) {
      console.warn("Could not create expense category:", createErr);
      // Fallback: fetch any available category
      const { data: anyCat } = await supabase
        .from("expense_categories")
        .select("id, name")
        .eq("user_id", userId)
        .limit(1);

      if (anyCat && anyCat.length > 0) {
        return { id: anyCat[0].id, name: anyCat[0].name };
      }
      return { id: "general", name: normalized };
    }

    return { id: created.id, name: created.name };
  } catch (err) {
    console.error("Error in ensureExpenseCategory:", err);
    return { id: "general", name: normalized };
  }
}

/**
 * Finds or maps an income category
 */
export async function ensureIncomeCategory(
  categoryName: string
): Promise<{ id: string; name: string }> {
  const normalized = (categoryName || "Salary").trim();

  try {
    const { data: categories, error } = await supabase
      .from("income_categories")
      .select("id, name")
      .order("name");

    if (error || !categories || categories.length === 0) {
      return { id: "income-default", name: normalized };
    }

    const lower = normalized.toLowerCase();
    const matched = categories.find((c) => c.name?.toLowerCase().includes(lower));
    if (matched) {
      return { id: matched.id, name: matched.name };
    }

    // Fallback to first available category
    return { id: categories[0].id, name: categories[0].name };
  } catch {
    return { id: "income-default", name: normalized };
  }
}

/**
 * Persists a validated transaction to Supabase.
 * Enforces user authorization, idempotency, category mapping, and budget updates.
 */
export async function createTransaction(
  draft: TransactionDraft,
  userId: string,
  idempotencyKey?: string
): Promise<{ success: boolean; record?: TransactionRecord; error?: string }> {
  cleanIdempotencyStore();

  // 1. Check idempotency
  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    const cached = idempotencyStore.get(idempotencyKey)!;
    return { success: true, record: cached.record };
  }

  // 2. Validate
  const validation = validateTransactionDraft(draft);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(", ") };
  }

  const amount = Number(draft.amount);
  const description = draft.description?.trim() || (draft.type === "income" ? "Income" : "Expense");
  const date = draft.transactionDate!;
  const rawCategory = draft.category?.trim() || (draft.type === "income" ? "Salary" : "General");

  try {
    if (draft.type === "expense") {
      // 3A. Handle Expense
      const categoryObj = await ensureExpenseCategory(userId, rawCategory);

      // Insert into expenses
      const { data: expense, error: expError } = await supabase
        .from("expenses")
        .insert([
          {
            amount,
            description,
            date,
            user_id: userId,
          },
        ])
        .select("id, amount, description, date, created_at")
        .single();

      if (expError || !expense) {
        throw new Error(expError?.message || "Failed to create expense record");
      }

      // Insert category mapping
      if (categoryObj.id && categoryObj.id !== "general") {
        await supabase.from("expense_category_mappings").insert([
          {
            expense_id: expense.id,
            category_id: categoryObj.id,
            user_id: userId,
          },
        ]);

        // Keep budget spent in sync if a budget exists for that month
        const month = `${date.slice(0, 7)}-01`;
        const { data: budget } = await supabase
          .from("budgets")
          .select("id, spent")
          .eq("user_id", userId)
          .eq("category_id", categoryObj.id)
          .eq("month", month)
          .maybeSingle();

        if (budget) {
          await supabase
            .from("budgets")
            .update({ spent: (budget.spent || 0) + amount })
            .eq("id", budget.id);
        }
      }

      const record: TransactionRecord = {
        id: expense.id,
        type: "expense",
        amount: Number(expense.amount),
        description: expense.description,
        category: categoryObj.name,
        categoryId: categoryObj.id,
        date: expense.date,
        createdAt: expense.created_at,
      };

      if (idempotencyKey) {
        idempotencyStore.set(idempotencyKey, { record, timestamp: Date.now() });
      }

      return { success: true, record };
    } else {
      // 3B. Handle Income
      const categoryObj = await ensureIncomeCategory(rawCategory);

      const payload: Record<string, any> = {
        amount,
        in_hand_amount: amount,
        description,
        date,
        is_holiday: false,
        user_id: userId,
      };

      if (categoryObj.id && categoryObj.id !== "income-default") {
        payload.category_id = categoryObj.id;
      }

      const { data: income, error: incError } = await supabase
        .from("income")
        .insert([payload])
        .select("id, amount, description, date, created_at")
        .single();

      if (incError || !income) {
        throw new Error(incError?.message || "Failed to create income record");
      }

      const record: TransactionRecord = {
        id: income.id,
        type: "income",
        amount: Number(income.amount),
        description: income.description,
        category: categoryObj.name,
        categoryId: categoryObj.id,
        date: income.date,
        createdAt: income.created_at,
      };

      if (idempotencyKey) {
        idempotencyStore.set(idempotencyKey, { record, timestamp: Date.now() });
      }

      return { success: true, record };
    }
  } catch (err: any) {
    console.error("Transaction persistence error:", err);
    return { success: false, error: err.message || "Database persistence failed" };
  }
}

/**
 * Updates an existing transaction (e.g. for conversational corrections like "Actually it was ₹900")
 */
export async function updateTransaction(
  userId: string,
  id: string,
  type: TransactionType,
  updates: Partial<Pick<TransactionRecord, "amount" | "description" | "category" | "date">>
): Promise<{ success: boolean; record?: TransactionRecord; error?: string }> {
  try {
    if (type === "expense") {
      const dbUpdates: Record<string, any> = {};
      if (updates.amount !== undefined) dbUpdates.amount = Number(updates.amount);
      if (updates.description !== undefined) dbUpdates.description = updates.description.trim();
      if (updates.date !== undefined) dbUpdates.date = updates.date;

      const { data: updated, error } = await supabase
        .from("expenses")
        .update(dbUpdates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, amount, description, date, created_at")
        .single();

      if (error || !updated) {
        return { success: false, error: error?.message || "Failed to update expense" };
      }

      let categoryName = updates.category || "General";
      if (updates.category) {
        const catObj = await ensureExpenseCategory(userId, updates.category);
        categoryName = catObj.name;
        // update mapping
        await supabase
          .from("expense_category_mappings")
          .delete()
          .eq("expense_id", id)
          .eq("user_id", userId);

        await supabase.from("expense_category_mappings").insert([
          { expense_id: id, category_id: catObj.id, user_id: userId },
        ]);
      }

      return {
        success: true,
        record: {
          id: updated.id,
          type: "expense",
          amount: Number(updated.amount),
          description: updated.description,
          category: categoryName,
          date: updated.date,
          createdAt: updated.created_at,
        },
      };
    } else {
      const dbUpdates: Record<string, any> = {};
      if (updates.amount !== undefined) {
        dbUpdates.amount = Number(updates.amount);
        dbUpdates.in_hand_amount = Number(updates.amount);
      }
      if (updates.description !== undefined) dbUpdates.description = updates.description.trim();
      if (updates.date !== undefined) dbUpdates.date = updates.date;

      if (updates.category) {
        const catObj = await ensureIncomeCategory(updates.category);
        if (catObj.id && catObj.id !== "income-default") {
          dbUpdates.category_id = catObj.id;
        }
      }

      const { data: updated, error } = await supabase
        .from("income")
        .update(dbUpdates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, amount, description, date, created_at")
        .single();

      if (error || !updated) {
        return { success: false, error: error?.message || "Failed to update income" };
      }

      return {
        success: true,
        record: {
          id: updated.id,
          type: "income",
          amount: Number(updated.amount),
          description: updated.description,
          category: updates.category || "Salary",
          date: updated.date,
          createdAt: updated.created_at,
        },
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update transaction" };
  }
}

/**
 * Deletes an existing transaction (e.g. for "Delete the transaction I just added")
 */
export async function deleteTransaction(
  userId: string,
  id: string,
  type: TransactionType
): Promise<{ success: boolean; error?: string }> {
  try {
    if (type === "expense") {
      // Delete mapping first
      await supabase
        .from("expense_category_mappings")
        .delete()
        .eq("expense_id", id)
        .eq("user_id", userId);

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    } else {
      const { error } = await supabase
        .from("income")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete transaction" };
  }
}

