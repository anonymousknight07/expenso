import { supabase } from "../lib/supabase";
import { parseDateRange, DateRangeResult } from "./dateService";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export interface CategorySpend {
  category: string;
  amount: number;
  percentage: number;
  color?: string;
}

export interface FinancialSummary {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number; // Income - Expenses
  savingsRate: number; // % of income saved
  biggestCategory: CategorySpend | null;
  categoryBreakdown: CategorySpend[];
  expenseCount: number;
  incomeCount: number;
}

export interface PeriodComparison {
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  currentExpense: number;
  previousExpense: number;
  difference: number;
  percentageChange: number;
  increased: boolean;
}

/**
 * Fetches expenses for a specific user and date range, joined with category names.
 */
export async function fetchUserExpenses(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ id: string; amount: number; description: string; date: string; category: string }[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(`
      id,
      amount,
      description,
      date,
      expense_category_mappings (
        expense_categories (
          name,
          color
        )
      )
    `)
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error || !data) {
    console.error("Error fetching expenses for query:", error);
    return [];
  }

  return data.map((e: any) => {
    const mapping = Array.isArray(e.expense_category_mappings)
      ? e.expense_category_mappings[0]
      : e.expense_category_mappings;
    const cat = Array.isArray(mapping?.expense_categories)
      ? mapping.expense_categories[0]
      : mapping?.expense_categories;

    return {
      id: e.id,
      amount: Number(e.amount || 0),
      description: e.description || "Expense",
      date: e.date,
      category: cat?.name || "General",
    };
  });
}

/**
 * Fetches income for a specific user and date range.
 */
export async function fetchUserIncome(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ id: string; amount: number; description: string; date: string; category: string }[]> {
  const { data, error } = await supabase
    .from("income")
    .select(`
      id,
      amount,
      in_hand_amount,
      description,
      date,
      category:income_categories (
        name
      )
    `)
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error || !data) {
    console.error("Error fetching income for query:", error);
    return [];
  }

  return data.map((i: any) => {
    const cat = Array.isArray(i.category) ? i.category[0] : i.category;
    return {
      id: i.id,
      amount: Number(i.in_hand_amount || i.amount || 0),
      description: i.description || "Income",
      date: i.date,
      category: cat?.name || "Salary",
    };
  });
}

/**
 * Generates verified financial calculations for a given date range.
 */
export async function getFinancialSummary(
  userId: string,
  range: DateRangeResult
): Promise<FinancialSummary> {
  const [expenses, income] = await Promise.all([
    fetchUserExpenses(userId, range.startDateStr, range.endDateStr),
    fetchUserIncome(userId, range.startDateStr, range.endDateStr),
  ]);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const netCashFlow = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netCashFlow / totalIncome) * 100)) : 0;

  // Category breakdown
  const catMap: Record<string, number> = {};
  for (const exp of expenses) {
    catMap[exp.category] = (catMap[exp.category] || 0) + exp.amount;
  }

  const categoryBreakdown: CategorySpend[] = Object.entries(catMap)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const biggestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

  return {
    periodLabel: range.label,
    startDate: range.startDateStr,
    endDate: range.endDateStr,
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    biggestCategory,
    categoryBreakdown,
    expenseCount: expenses.length,
    incomeCount: income.length,
  };
}

/**
 * Compares current month expenses with last month.
 */
export async function compareWithLastMonth(
  userId: string,
  referenceDate: Date = new Date()
): Promise<PeriodComparison> {
  // Current month
  const currentStart = format(startOfMonth(referenceDate), "yyyy-MM-dd");
  const currentEnd = format(endOfMonth(referenceDate), "yyyy-MM-dd");

  // Previous month
  const prevDate = subMonths(referenceDate, 1);
  const prevStart = format(startOfMonth(prevDate), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(prevDate), "yyyy-MM-dd");

  const [currentExpenses, prevExpenses] = await Promise.all([
    fetchUserExpenses(userId, currentStart, currentEnd),
    fetchUserExpenses(userId, prevStart, prevEnd),
  ]);

  const currentExpense = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const previousExpense = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
  const difference = currentExpense - previousExpense;
  const percentageChange =
    previousExpense > 0
      ? Math.round((Math.abs(difference) / previousExpense) * 100)
      : currentExpense > 0
      ? 100
      : 0;

  return {
    currentPeriodLabel: "This Month",
    previousPeriodLabel: "Last Month",
    currentExpense,
    previousExpense,
    difference,
    percentageChange,
    increased: difference > 0,
  };
}

/**
 * Answers category-specific questions (e.g. "How much did I spend on food this month?")
 */
export async function getCategorySpend(
  userId: string,
  categoryKeyword: string,
  range: DateRangeResult
): Promise<{
  matchedCategory: string;
  totalSpent: number;
  transactions: { description: string; amount: number; date: string }[];
}> {
  const expenses = await fetchUserExpenses(userId, range.startDateStr, range.endDateStr);
  const lowerKeyword = categoryKeyword.toLowerCase().trim();

  const matched = expenses.filter(
    (e) =>
      e.category.toLowerCase().includes(lowerKeyword) ||
      e.description.toLowerCase().includes(lowerKeyword)
  );

  const totalSpent = matched.reduce((sum, e) => sum + e.amount, 0);

  return {
    matchedCategory: categoryKeyword,
    totalSpent,
    transactions: matched.map((m) => ({
      description: m.description,
      amount: m.amount,
      date: m.date,
    })),
  };
}

