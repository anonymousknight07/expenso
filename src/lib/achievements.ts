import { supabase } from "./supabase";

export interface Badge {
  id: string;
  title: string;
  description: string;
  category: "monthly" | "milestone" | "budgeting" | "savings" | "tools";
  tier: "bronze" | "silver" | "gold" | "platinum";
  xp: number;
  iconName: string;
  targetCount: number;
  month?: string; // Optional YYYY-MM for month-specific challenges
}

export interface UserProgress {
  badgeId: string;
  currentCount: number;
  targetCount: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export const ALL_BADGES: Badge[] = [
  // ── Monthly Challenges (Refreshed per month) ────────────────
  {
    id: "monthly_master_current",
    title: "Monthly Master",
    description: "Log at least 5 expenses and keep total spent under your monthly budget limit.",
    category: "monthly",
    tier: "gold",
    xp: 250,
    iconName: "Crown",
    targetCount: 5,
  },
  {
    id: "monthly_streak_hero",
    title: "Consistent Logger",
    description: "Log expenses on at least 5 different days in the current month.",
    category: "monthly",
    tier: "silver",
    xp: 150,
    iconName: "Flame",
    targetCount: 5,
  },
  {
    id: "monthly_budget_guardian",
    title: "Zero Overspend",
    description: "Have zero category budget overspends for the active month.",
    category: "monthly",
    tier: "platinum",
    xp: 300,
    iconName: "ShieldCheck",
    targetCount: 1,
  },

  // ── Milestones (Core Progress) ──────────────────────────────
  {
    id: "first_expense",
    title: "First Step",
    description: "Log your very first expense entry in Expenso.",
    category: "milestone",
    tier: "bronze",
    xp: 50,
    iconName: "Sparkles",
    targetCount: 1,
  },
  {
    id: "ledger_enthusiast",
    title: "Ledger Enthusiast",
    description: "Log a total of 15 expenses.",
    category: "milestone",
    tier: "silver",
    xp: 100,
    iconName: "BarChart3",
    targetCount: 15,
  },
  {
    id: "financial_historian",
    title: "Financial Historian",
    description: "Log a total of 50 expenses.",
    category: "milestone",
    tier: "gold",
    xp: 250,
    iconName: "Trophy",
    targetCount: 50,
  },
  {
    id: "master_accountant",
    title: "Master Accountant",
    description: "Log a total of 100 expenses across all time.",
    category: "milestone",
    tier: "platinum",
    xp: 500,
    iconName: "Award",
    targetCount: 100,
  },

  // ── Budgeting ───────────────────────────────────────────────
  {
    id: "budget_architect",
    title: "Budget Architect",
    description: "Set up category budgets for at least 3 distinct categories.",
    category: "budgeting",
    tier: "bronze",
    xp: 100,
    iconName: "Target",
    targetCount: 3,
  },
  {
    id: "budget_disciplinarian",
    title: "Disciplined Saver",
    description: "Keep total spending below 80% of your total category budget limit.",
    category: "budgeting",
    tier: "gold",
    xp: 200,
    iconName: "ShieldCheck",
    targetCount: 1,
  },

  // ── Savings ─────────────────────────────────────────────────
  {
    id: "income_tracker",
    title: "Wealth Inflow",
    description: "Record your monthly income and setup in-hand earnings.",
    category: "savings",
    tier: "bronze",
    xp: 75,
    iconName: "Wallet",
    targetCount: 1,
  },
  {
    id: "savings_dynamo",
    title: "Savings Dynamo",
    description: "Achieve a net monthly savings rate of 30% or more.",
    category: "savings",
    tier: "gold",
    xp: 250,
    iconName: "TrendingUp",
    targetCount: 30, // 30% savings rate
  },
  {
    id: "jar_system_master",
    title: "6-Jar Manager",
    description: "Allocate funds into the 6-Jar Money Management System.",
    category: "savings",
    tier: "silver",
    xp: 150,
    iconName: "Gift",
    targetCount: 1,
  },

  // ── Power Tools ─────────────────────────────────────────────
  {
    id: "upi_digital_pro",
    title: "UPI Power User",
    description: "Sync or process transactions using the UPI Sync tool.",
    category: "tools",
    tier: "silver",
    xp: 150,
    iconName: "Zap",
    targetCount: 1,
  },
  {
    id: "receipt_scanner_pro",
    title: "Receipt Collector",
    description: "Scan and confirm an expense using the Receipt Scanner.",
    category: "tools",
    tier: "silver",
    xp: 150,
    iconName: "Receipt",
    targetCount: 1,
  },
];

export async function evaluateUserAchievements(userId: string): Promise<{
  progressMap: Record<string, UserProgress>;
  totalXp: number;
  unlockedCount: number;
  level: number;
  rankTitle: string;
}> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthStartDate = `${currentMonth}-01`;

  // 1. Fetch user expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, amount, date")
    .eq("user_id", userId);

  const expenseList = expenses || [];
  const totalExpenseCount = expenseList.length;

  const currentMonthExpenses = expenseList.filter((e) =>
    e.date.startsWith(currentMonth)
  );
  const currentMonthExpenseCount = currentMonthExpenses.length;

  // Unique days with expenses logged in current month
  const uniqueDaysInMonth = new Set(
    currentMonthExpenses.map((e) => e.date)
  ).size;

  // 2. Fetch user budgets for current month
  const { data: budgets } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId);

  const budgetList = budgets || [];
  const currentMonthBudgets = budgetList.filter((b) =>
    b.month.startsWith(currentMonth)
  );
  const activeCategoryBudgetsCount = new Set(
    currentMonthBudgets.map((b) => b.category_id)
  ).size;

  const totalBudgetAmount = currentMonthBudgets.reduce(
    (sum, b) => sum + Number(b.amount || 0),
    0
  );
  const totalBudgetSpent = currentMonthBudgets.reduce(
    (sum, b) => sum + Number(b.spent || 0),
    0
  );

  const hasExceededBudgets = currentMonthBudgets.some(
    (b) => Number(b.spent || 0) > Number(b.amount || 0)
  );

  // 3. Fetch income / monthly budget
  const { data: incomes } = await supabase
    .from("income")
    .select("in_hand_amount, amount")
    .eq("user_id", userId);

  const monthlyIncome = (incomes || []).reduce(
    (sum, inc) => sum + Number(inc.in_hand_amount || inc.amount || 0),
    0
  );

  const totalSpentInMonth = currentMonthExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const savingsRate =
    monthlyIncome > 0
      ? Math.max(0, Math.round(((monthlyIncome - totalSpentInMonth) / monthlyIncome) * 100))
      : 0;

  // 4. Fetch local / custom metrics fallback
  let receiptScannedCount = 0;
  let upiSyncCount = 0;
  let jarAllocated = false;

  try {
    const savedUnlocked = localStorage.getItem(`expenso_achievements_${userId}`);
    const parsedObj = savedUnlocked ? JSON.parse(savedUnlocked) : {};
    receiptScannedCount = parsedObj.receiptScannedCount || 0;
    upiSyncCount = parsedObj.upiSyncCount || 0;
    jarAllocated = parsedObj.jarAllocated || false;
  } catch (e) {
    // Ignore localStorage error
  }

  // 5. Evaluate progress for each badge
  const progressMap: Record<string, UserProgress> = {};
  let totalXp = 0;
  let unlockedCount = 0;

  ALL_BADGES.forEach((badge) => {
    let current = 0;

    switch (badge.id) {
      case "first_expense":
        current = totalExpenseCount;
        break;
      case "ledger_enthusiast":
        current = totalExpenseCount;
        break;
      case "financial_historian":
        current = totalExpenseCount;
        break;
      case "master_accountant":
        current = totalExpenseCount;
        break;
      case "monthly_master_current":
        current =
          currentMonthExpenseCount >= 5 &&
          totalBudgetAmount > 0 &&
          totalBudgetSpent <= totalBudgetAmount
            ? 5
            : Math.min(currentMonthExpenseCount, 4);
        break;
      case "monthly_streak_hero":
        current = uniqueDaysInMonth;
        break;
      case "monthly_budget_guardian":
        current = currentMonthBudgets.length > 0 && !hasExceededBudgets ? 1 : 0;
        break;
      case "budget_architect":
        current = activeCategoryBudgetsCount;
        break;
      case "budget_disciplinarian":
        current =
          totalBudgetAmount > 0 && totalBudgetSpent <= totalBudgetAmount * 0.8
            ? 1
            : 0;
        break;
      case "income_tracker":
        current = monthlyIncome > 0 ? 1 : 0;
        break;
      case "savings_dynamo":
        current = savingsRate;
        break;
      case "jar_system_master":
        current = jarAllocated ? 1 : 0;
        break;
      case "upi_digital_pro":
        current = upiSyncCount > 0 ? 1 : 0;
        break;
      case "receipt_scanner_pro":
        current = receiptScannedCount > 0 ? 1 : 0;
        break;
      default:
        current = 0;
    }

    const unlocked = current >= badge.targetCount;
    if (unlocked) {
      unlockedCount++;
      totalXp += badge.xp;
    }

    progressMap[badge.id] = {
      badgeId: badge.id,
      currentCount: Math.min(current, badge.targetCount),
      targetCount: badge.targetCount,
      unlocked,
      unlockedAt: unlocked ? new Date().toISOString() : undefined,
    };
  });

  // Calculate Level & Rank
  const level = Math.floor(totalXp / 150) + 1;

  let rankTitle = "Novice Saver";
  if (level >= 10) rankTitle = "Financial Legend 👑";
  else if (level >= 7) rankTitle = "Gold Wealth Builder 🏆";
  else if (level >= 4) rankTitle = "Silver Strategist ⚡";
  else if (level >= 2) rankTitle = "Bronze Planner 🛡️";

  return {
    progressMap,
    totalXp,
    unlockedCount,
    level,
    rankTitle,
  };
}

export function saveAchievementMeta(
  userId: string,
  key: "receiptScannedCount" | "upiSyncCount" | "jarAllocated",
  value: number | boolean
) {
  try {
    const storageKey = `expenso_achievements_${userId}`;
    const saved = localStorage.getItem(storageKey);
    const meta = saved ? JSON.parse(saved) : {};
    meta[key] = value;
    localStorage.setItem(storageKey, JSON.stringify(meta));
  } catch (e) {
    console.error("Error saving achievement meta:", e);
  }
}
