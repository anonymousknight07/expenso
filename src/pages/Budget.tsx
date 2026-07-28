import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  File as FilePdf,
  BellOff,
  Bell,
  Edit2,
  X,
  Wallet,
  PiggyBank,
  AlertTriangle,
  RefreshCw,
  PieChart,
  Target,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import Button from "../components/common/Button";
import { useCurrency } from "../contexts/CurrencyContext";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { toast } from "react-hot-toast";

interface Budget {
  id: string;
  category_id: string;
  amount: number;
  month: string;
  spent: number;
  notification_threshold: number;
  category: Category;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface BudgetAlert {
  id: string;
  user_id: string;
  budget_id: string;
  type: string;
  created_at: string;
  acknowledged: boolean;
}

interface MonthlyBudget {
  id: string;
  user_id: string;
  month: string;
  amount: number;
  created_at: string;
}

const Budget = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [effectiveIncome, setEffectiveIncome] = useState<number>(0);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudget | null>(
    null
  );
  const [isSettingMonthlyBudget, setIsSettingMonthlyBudget] = useState(false);
  const [isEditingMonthlyBudget, setIsEditingMonthlyBudget] = useState(false);
  const [monthlyBudgetAmount, setMonthlyBudgetAmount] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const { currency, calculateEffectiveIncome } = useCurrency();

  const [newBudget, setNewBudget] = useState({
    category_id: "",
    amount: "",
    month: selectedMonth,
    notification_threshold: 0.75,
  });

  const updateEffectiveIncome = async () => {
    const income = await calculateEffectiveIncome();
    setEffectiveIncome(income);
  };

  useEffect(() => {
    fetchBudgetsWithSpent();
    fetchMonthlyBudget();
  }, [selectedMonth]);

  useEffect(() => {
    fetchCategories();
    fetchAlerts();
    updateEffectiveIncome();

    const expensesChannel = supabase
      .channel("expenses_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
        },
        () => {
          fetchBudgetsWithSpent();
        }
      )
      .subscribe();

    const mappingsChannel = supabase
      .channel("mappings_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expense_category_mappings",
        },
        () => {
          fetchBudgetsWithSpent();
        }
      )
      .subscribe();

    const budgetsChannel = supabase
      .channel("budgets_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budgets",
        },
        () => {
          fetchBudgetsWithSpent();
        }
      )
      .subscribe();

    const monthlyBudgetsChannel = supabase
      .channel("monthly_budgets_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budgets",
        },
        () => {
          fetchMonthlyBudget();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(mappingsChannel);
      supabase.removeChannel(budgetsChannel);
      supabase.removeChannel(monthlyBudgetsChannel);
    };
  }, []);

  useEffect(() => {
    if (budgets.length > 0) {
      checkBudgetAlerts();
      checkMonthlyBudgetAlert();
    }
  }, [budgets, monthlyBudget]);

  const changeMonth = (offset: number) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const newMonthStr = date.toISOString().slice(0, 7);
    setSelectedMonth(newMonthStr);
  };

  const fetchMonthlyBudget = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const monthDate = `${selectedMonth}-01`;

    const { data, error } = await supabase
      .from("monthly_budgets")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", monthDate)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching monthly budget:", error);
      return;
    }

    setMonthlyBudget(data);
  };

  const checkMonthlyBudgetAlert = async () => {
    if (!monthlyBudget) return;

    const totalCategoryBudgets = calculateTotalBudget();

    if (totalCategoryBudgets > monthlyBudget.amount) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingAlerts } = await supabase
        .from("budget_alerts")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "monthly_exceeded")
        .eq("acknowledged", false);

      if (!existingAlerts || existingAlerts.length === 0) {
        const { error } = await supabase.from("budget_alerts").insert([
          {
            user_id: user.id,
            budget_id: monthlyBudget.id,
            type: "monthly_exceeded",
            acknowledged: false,
          },
        ]);

        if (!error) {
          toast.error(
            `Category budgets exceed monthly budget by ${currency.symbol}${(
              totalCategoryBudgets - monthlyBudget.amount
            ).toFixed(2)}`,
            { duration: 6000 }
          );
          fetchAlerts();
        }
      }
    }
  };

  const handleSetMonthlyBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const monthDate = `${selectedMonth}-01`;

    const { error } = await supabase.from("monthly_budgets").insert([
      {
        user_id: user.id,
        month: monthDate,
        amount: parseFloat(monthlyBudgetAmount),
      },
    ]);

    if (error) {
      console.error("Error setting monthly budget:", error);
      toast.error("Error setting monthly budget");
      return;
    }

    setMonthlyBudgetAmount("");
    setIsSettingMonthlyBudget(false);
    fetchMonthlyBudget();
    toast.success(`Monthly budget for ${selectedMonth} set successfully`);
  };

  const handleUpdateMonthlyBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!monthlyBudget) return;

    const { error } = await supabase
      .from("monthly_budgets")
      .update({ amount: parseFloat(monthlyBudgetAmount) })
      .eq("id", monthlyBudget.id);

    if (error) {
      console.error("Error updating monthly budget:", error);
      toast.error("Error updating monthly budget");
      return;
    }

    setMonthlyBudgetAmount("");
    setIsEditingMonthlyBudget(false);
    fetchMonthlyBudget();
    toast.success("Monthly budget updated successfully");
  };

  const handleDeleteMonthlyBudget = async () => {
    if (!monthlyBudget) return;

    const { error } = await supabase
      .from("monthly_budgets")
      .delete()
      .eq("id", monthlyBudget.id);

    if (error) {
      console.error("Error deleting monthly budget:", error);
      toast.error("Error deleting monthly budget");
      return;
    }

    setMonthlyBudget(null);
    toast.success("Monthly budget deleted successfully");
  };

  const fetchBudgetsWithSpent = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const startDate = `${selectedMonth}-01`;
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    const { data: budgetsData, error: budgetsError } = await supabase
      .from("budgets")
      .select(
        `
        *,
        category:expense_categories(*)
      `
      )
      .eq("user_id", user.id);

    if (budgetsError) {
      console.error("Error fetching budgets:", budgetsError);
      return;
    }

    if (!budgetsData || budgetsData.length === 0) {
      setBudgets([]);
      return;
    }

    const currentMonthBudgets = budgetsData.filter((budget) => {
      const budgetMonth = budget.month.substring(0, 7);
      return budgetMonth === selectedMonth;
    });

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select(
        `
        id,
        amount,
        date,
        category_id,
        expense_category_mappings (
          category_id
        )
      `
      )
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate);

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError);
      return;
    }

    const updatedBudgets = currentMonthBudgets.map((budget) => {
      const categoryExpenses =
        expensesData?.filter((expense: any) => {
          const mappingCategoryIds = (
            expense.expense_category_mappings || []
          ).map((m: any) => m.category_id);
          return (
            mappingCategoryIds.includes(budget.category_id) ||
            expense.category_id === budget.category_id
          );
        }) || [];

      const spentAmount = categoryExpenses.reduce(
        (total: number, expense: any) =>
          total +
          (typeof expense.amount === "number"
            ? expense.amount
            : parseFloat(expense.amount) || 0),
        0
      );

      return {
        ...budget,
        spent: spentAmount,
      };
    });

    setBudgets(updatedBudgets);
  };

  const fetchCategories = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    setCategories(data || []);
  };

  const fetchAlerts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("budget_alerts")
      .select("*")
      .eq("user_id", user.id)
      .eq("acknowledged", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching alerts:", error);
      return;
    }

    setAlerts(data || []);
  };

  const checkBudgetAlerts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    for (const budget of budgets) {
      const spendRatio = budget.amount > 0 ? budget.spent / budget.amount : 0;
      const isExceeded = spendRatio > 1;
      const isApproaching =
        spendRatio >= budget.notification_threshold && spendRatio <= 1;

      if (isExceeded || isApproaching) {
        const alertType = isExceeded ? "exceeded" : "approaching";

        const { data: existingAlerts } = await supabase
          .from("budget_alerts")
          .select("*")
          .eq("budget_id", budget.id)
          .eq("type", alertType)
          .eq("acknowledged", false);

        if (!existingAlerts || existingAlerts.length === 0) {
          const { error } = await supabase.from("budget_alerts").insert([
            {
              user_id: user.id,
              budget_id: budget.id,
              type: alertType,
              acknowledged: false,
            },
          ]);

          if (!error) {
            toast.error(
              `${
                isExceeded ? "Budget exceeded" : "Approaching budget limit"
              }: ${budget.category?.name || "Category"}`,
              { duration: 5000 }
            );
            fetchAlerts();
          }
        }
      }
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from("budget_alerts")
      .update({ acknowledged: true })
      .eq("id", alertId);

    if (error) {
      console.error("Error acknowledging alert:", error);
      return;
    }

    setAlerts(alerts.filter((alert) => alert.id !== alertId));
  };

  const handleAcknowledgeAllAlerts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("budget_alerts")
      .update({ acknowledged: true })
      .eq("user_id", user.id)
      .eq("acknowledged", false);

    if (error) {
      console.error("Error acknowledging all alerts:", error);
      return;
    }

    setAlerts([]);
    setShowAlerts(false);
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const monthDate = `${newBudget.month}-01`;

    const { error } = await supabase.from("budgets").insert([
      {
        category_id: newBudget.category_id,
        amount: parseFloat(newBudget.amount),
        month: monthDate,
        notification_threshold: newBudget.notification_threshold,
        spent: 0,
        user_id: user.id,
      },
    ]);

    if (error) {
      console.error("Error adding budget:", error);
      toast.error("Error creating budget");
      return;
    }

    const createdMonth = newBudget.month.slice(0, 7);
    setSelectedMonth(createdMonth);

    setNewBudget({
      category_id: "",
      amount: "",
      month: createdMonth,
      notification_threshold: 0.75,
    });
    setIsAddingBudget(false);
    toast.success(`Budget created for ${createdMonth}`);
    fetchBudgetsWithSpent();
  };

  const handleDeleteBudget = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);

    if (error) {
      console.error("Error deleting budget:", error);
      toast.error("Failed to delete budget");
      return;
    }

    toast.success("Budget removed");
    fetchBudgetsWithSpent();
  };

  const calculateTotalBudget = () => {
    return budgets.reduce((total, budget) => total + budget.amount, 0);
  };

  const calculateTotalSpent = () => {
    return budgets.reduce((total, budget) => total + budget.spent, 0);
  };

  const calculateSavings = () => {
    return effectiveIncome - calculateTotalBudget();
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const data = budgets.map((budget) => ({
      Category: budget.category?.name || "Uncategorized",
      "Budget Amount": `${currency.symbol}${budget.amount.toFixed(2)}`,
      "Spent Amount": `${currency.symbol}${budget.spent.toFixed(2)}`,
      Remaining: `${currency.symbol}${(budget.amount - budget.spent).toFixed(
        2
      )}`,
      Progress: `${((budget.spent / (budget.amount || 1)) * 100).toFixed(1)}%`,
      "Alert Threshold": `${(budget.notification_threshold * 100).toFixed(0)}%`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [`Monthly Income: ${currency.symbol}${effectiveIncome.toFixed(2)}`],
        [
          `Monthly Budget: ${currency.symbol}${
            monthlyBudget?.amount.toFixed(2) || "0.00"
          }`,
        ],
        [
          `Total Category Budgets: ${
            currency.symbol
          }${calculateTotalBudget().toFixed(2)}`,
        ],
        [`Savings: ${currency.symbol}${calculateSavings().toFixed(2)}`],
      ],
      { origin: -1 }
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, `Budget Report ${selectedMonth}`);
    XLSX.writeFile(workbook, `Budget_${selectedMonth}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(`Budget Report (${selectedMonth})`, 20, 20);

    let yPos = 40;

    doc.setFontSize(14);
    doc.text(
      `Monthly Income: ${currency.symbol}${effectiveIncome.toFixed(2)}`,
      20,
      yPos
    );
    yPos += 10;
    doc.text(
      `Monthly Budget: ${currency.symbol}${
        monthlyBudget?.amount.toFixed(2) || "0.00"
      }`,
      20,
      yPos
    );
    yPos += 10;
    doc.text(
      `Total Category Budgets: ${
        currency.symbol
      }${calculateTotalBudget().toFixed(2)}`,
      20,
      yPos
    );
    yPos += 10;
    doc.text(
      `Savings: ${currency.symbol}${calculateSavings().toFixed(2)}`,
      20,
      yPos
    );
    yPos += 20;

    doc.setFontSize(12);
    budgets.forEach((budget) => {
      doc.text(budget.category?.name || "Uncategorized", 20, yPos);
      doc.text(`${currency.symbol}${budget.amount.toFixed(2)}`, 100, yPos);
      doc.text(
        `${((budget.spent / (budget.amount || 1)) * 100).toFixed(1)}%`,
        150,
        yPos
      );
      yPos += 10;
    });

    doc.save(`Budget_${selectedMonth}.pdf`);
  };

  const getBudgetForAlert = (alertBudgetId: string) => {
    const budget = budgets.find((budget) => budget.id === alertBudgetId);
    if (!budget) {
      if (monthlyBudget && alertBudgetId === monthlyBudget.id) {
        return {
          id: monthlyBudget.id,
          category: { name: "Monthly Budget", color: "#9333ea" },
          amount: monthlyBudget.amount,
          spent: calculateTotalBudget(),
        };
      }
      return null;
    }

    if (!budget.category) {
      const category = categories.find((cat) => cat.id === budget.category_id);
      if (category) {
        return {
          ...budget,
          category,
        };
      }
    }

    return budget;
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchBudgetsWithSpent(),
      fetchAlerts(),
      fetchMonthlyBudget(),
      updateEffectiveIncome(),
    ]);
    setIsRefreshing(false);
    toast.success("Budget data refreshed");
  };

  const formattedSelectedMonthName = new Date(
    selectedMonth + "-01"
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isCurrentSystemMonth =
    selectedMonth === new Date().toISOString().slice(0, 7);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Month Navigation Control Bar */}
      <div className="mb-6 glass-card p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-yellow/10 text-yellow">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Active Budget Period</h2>
            <p className="text-xs text-gray-400">View and manage budgets for any selected month</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              if (e.target.value) setSelectedMonth(e.target.value);
            }}
            className="px-3 py-1.5 rounded-xl border border-white/10 bg-[#1c1d23] text-white text-sm font-semibold focus:border-yellow"
          />

          <button
            onClick={() => changeMonth(1)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isCurrentSystemMonth && (
            <button
              onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
              className="ml-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-yellow/10 text-yellow border border-yellow/20 hover:bg-yellow/20 transition-all"
            >
              Current Month
            </button>
          )}
        </div>
      </div>

      {/* Header & Main Actions */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-gray-400">
                Budget Management
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow/10 text-yellow border border-yellow/20 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                {formattedSelectedMonthName}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              Plan, monitor, and optimize limits for {formattedSelectedMonthName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className={`relative px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 border ${
                  alerts.length > 0
                    ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                    : "bg-white/[0.05] border-white/10 text-gray-300 hover:bg-white/10"
                }`}
              >
                {alerts.length > 0 ? (
                  <Bell className="w-4 h-4 text-red-400 animate-pulse" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-400" />
                )}
                <span>Alerts</span>
                {alerts.length > 0 && (
                  <span className="bg-red-500 text-white rounded-full text-[11px] font-bold h-5 px-1.5 flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
              </button>

              {showAlerts && alerts.length > 0 && (
                <div className="absolute right-0 mt-2 w-72 md:w-96 glass-modal z-50 overflow-hidden shadow-2xl rounded-2xl border border-white/10 animate-fade-in-out">
                  <div className="p-3.5 bg-white/[0.04] border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      <h3 className="font-semibold text-sm">Budget Alerts</h3>
                    </div>
                    <button
                      onClick={handleAcknowledgeAllAlerts}
                      className="text-xs text-yellow hover:underline"
                    >
                      Dismiss All
                    </button>
                  </div>
                  <div className="p-2 max-h-80 overflow-y-auto divide-y divide-white/[0.06]">
                    {alerts.map((alert) => {
                      const budget = getBudgetForAlert(alert.budget_id);
                      if (!budget) return null;

                      return (
                        <div
                          key={alert.id}
                          className="p-3 hover:bg-white/[0.03] transition-colors flex justify-between items-start gap-3"
                        >
                          <div>
                            <p className="font-semibold text-sm text-white flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block"
                                style={{
                                  backgroundColor:
                                    budget.category?.color || "#ff3c02",
                                }}
                              />
                              {budget.category?.name || "Category"}
                            </p>
                            <p className="text-xs text-red-400 font-medium mt-0.5">
                              {alert.type === "exceeded"
                                ? "Budget Exceeded!"
                                : alert.type === "approaching"
                                ? "Approaching Limit"
                                : alert.type === "monthly_exceeded"
                                ? "Total Budgets exceed Monthly Budget!"
                                : "Budget Alert"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {currency.symbol}
                              {budget.spent.toFixed(2)} of {currency.symbol}
                              {budget.amount.toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-xl font-medium text-sm bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin text-yellow" : ""}`}
              />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportToExcel}
              className="px-4 py-2.5 rounded-xl font-medium text-sm bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all duration-200 flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            <button
              onClick={exportToPDF}
              className="px-4 py-2.5 rounded-xl font-medium text-sm bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all duration-200 flex items-center gap-2"
            >
              <FilePdf className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            <Button
              onClick={() => {
                setNewBudget((prev) => ({ ...prev, month: selectedMonth }));
                setIsAddingBudget(true);
              }}
              variant="primary"
              className="shadow-lg shadow-yellow/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </Button>
          </div>
        </div>

        {/* High-Tech Monthly Budget Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/50 p-6 backdrop-blur-xl shadow-2xl">
          <div className="absolute -right-12 -top-12 w-56 h-56 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                  <Target className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold text-purple-200">
                  Overall Target Cap ({formattedSelectedMonthName})
                </h2>
              </div>

              {monthlyBudget ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-white tracking-tight">
                      {currency.symbol}
                      {monthlyBudget.amount.toFixed(2)}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                      Target Limit
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pt-1">
                    <div className="glass-inset p-3 border-white/5">
                      <p className="text-xs text-gray-400">Total Allocated Categories</p>
                      <p className="text-base font-bold text-sky-300 mt-0.5">
                        {currency.symbol}
                        {calculateTotalBudget().toFixed(2)}
                      </p>
                    </div>
                    <div className="glass-inset p-3 border-white/5">
                      <p className="text-xs text-gray-400">Budget Status</p>
                      <p
                        className={`text-base font-bold mt-0.5 flex items-center gap-1.5 ${
                          calculateTotalBudget() > monthlyBudget.amount
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {calculateTotalBudget() > monthlyBudget.amount ? (
                          <>
                            <AlertTriangle className="w-4 h-4" />
                            Over by {currency.symbol}
                            {(
                              calculateTotalBudget() - monthlyBudget.amount
                            ).toFixed(2)}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Under by {currency.symbol}
                            {(
                              monthlyBudget.amount - calculateTotalBudget()
                            ).toFixed(2)}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">
                  No overall monthly budget set for {formattedSelectedMonthName}.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {monthlyBudget ? (
                <>
                  <button
                    onClick={() => {
                      setMonthlyBudgetAmount(monthlyBudget.amount.toString());
                      setIsEditingMonthlyBudget(true);
                    }}
                    className="px-4 py-2.5 rounded-xl font-medium text-sm bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all duration-200 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4 text-purple-300" />
                    Edit Cap
                  </button>
                  <button
                    onClick={handleDeleteMonthlyBudget}
                    className="px-4 py-2.5 rounded-xl font-medium text-sm bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition-all duration-200 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    Remove
                  </button>
                </>
              ) : (
                <Button
                  onClick={() => setIsSettingMonthlyBudget(true)}
                  variant="primary"
                  className="shadow-lg shadow-purple-500/20"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Set Monthly Cap
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="glass-card p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-medium text-gray-400">
                Monthly Income
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
              {currency.symbol}
              {effectiveIncome.toFixed(2)}
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              In-hand earnings available
            </p>
          </div>

          <div className="glass-card p-6 relative overflow-hidden group hover:border-sky-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-medium text-gray-400">
                Allocated Budgets ({selectedMonth})
              </span>
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
                <PieChart className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-sky-400 tracking-tight">
              {currency.symbol}
              {calculateTotalBudget().toFixed(2)}
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center justify-between">
              <span>Spent so far:</span>
              <span className="font-semibold text-gray-200">
                {currency.symbol}
                {calculateTotalSpent().toFixed(2)}
              </span>
            </p>
          </div>

          <div className="glass-card p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-medium text-gray-400">
                Unallocated Savings
              </span>
              <div
                className={`p-2.5 rounded-xl ${
                  calculateSavings() >= 0
                    ? "bg-purple-500/10 text-purple-400"
                    : "bg-rose-500/10 text-rose-400"
                } group-hover:scale-110 transition-transform`}
              >
                <PiggyBank className="w-5 h-5" />
              </div>
            </div>
            <div
              className={`text-3xl font-extrabold tracking-tight ${
                calculateSavings() >= 0 ? "text-purple-300" : "text-rose-400"
              }`}
            >
              {currency.symbol}
              {calculateSavings().toFixed(2)}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {calculateSavings() >= 0
                ? "Remaining after budget allocation"
                : "Category budgets exceed income"}
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {(isSettingMonthlyBudget || isEditingMonthlyBudget) && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in-out">
          <div className="glass-modal p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-400" />
                {isEditingMonthlyBudget
                  ? `Edit Monthly Cap (${selectedMonth})`
                  : `Set Monthly Cap (${selectedMonth})`}
              </h2>
              <button
                onClick={() => {
                  setIsSettingMonthlyBudget(false);
                  setIsEditingMonthlyBudget(false);
                  setMonthlyBudgetAmount("");
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={
                isEditingMonthlyBudget
                  ? handleUpdateMonthlyBudget
                  : handleSetMonthlyBudget
              }
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Monthly Target Cap ({currency.symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={monthlyBudgetAmount}
                  onChange={(e) => setMonthlyBudgetAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white/[0.06] border-white/10 focus:border-purple-400 text-white text-base"
                  placeholder="e.g. 50000"
                  required
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Applies to {formattedSelectedMonthName} across all categories.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={() => {
                    setIsSettingMonthlyBudget(false);
                    setIsEditingMonthlyBudget(false);
                    setMonthlyBudgetAmount("");
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {isEditingMonthlyBudget ? "Update Cap" : "Set Cap"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingBudget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in-out">
          <div className="glass-modal p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-yellow" />
                Add Category Budget
              </h2>
              <button
                onClick={() => setIsAddingBudget(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Category
                </label>
                <select
                  value={newBudget.category_id}
                  onChange={(e) =>
                    setNewBudget({ ...newBudget, category_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-[#1c1d23] text-white focus:border-yellow"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Budget Amount ({currency.symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newBudget.amount}
                  onChange={(e) =>
                    setNewBudget({ ...newBudget, amount: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Target Month
                </label>
                <input
                  type="month"
                  value={newBudget.month}
                  onChange={(e) =>
                    setNewBudget({ ...newBudget, month: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Alert Warning Threshold ({Math.round(newBudget.notification_threshold * 100)}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={newBudget.notification_threshold * 100}
                  onChange={(e) =>
                    setNewBudget({
                      ...newBudget,
                      notification_threshold: parseInt(e.target.value) / 100,
                    })
                  }
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Trigger warning alert when spent reaches {Math.round(newBudget.notification_threshold * 100)}% of limit.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={() => setIsAddingBudget(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Budget
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Budgets Cards Section */}
      <div className="mt-8 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-yellow" />
            Category Budgets for {formattedSelectedMonthName} ({budgets.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const percentSpent =
              budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
            const isExceeded = budget.spent > budget.amount;
            const isApproaching =
              percentSpent >= budget.notification_threshold * 100 && !isExceeded;
            const remaining = Math.max(budget.amount - budget.spent, 0);

            const categoryColor = budget.category?.color || "#ff3c02";

            return (
              <div
                key={budget.id}
                className="glass-card p-5 relative group overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-2xl"
              >
                <div
                  className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-40"
                  style={{ backgroundColor: categoryColor }}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full border border-white/30 shadow-md"
                        style={{ backgroundColor: categoryColor }}
                      />
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {budget.category?.name || "Category"}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {isExceeded && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Exceeded
                        </span>
                      )}
                      {isApproaching && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Near Limit
                        </span>
                      )}
                      {!isExceeded && !isApproaching && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          On Track
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteBudget(budget.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                        title="Delete Budget"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <span className="text-xs text-gray-400">Spent: </span>
                      <span
                        className={`text-lg font-extrabold ${
                          isExceeded ? "text-rose-400" : "text-white"
                        }`}
                      >
                        {currency.symbol}
                        {budget.spent.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">Budget: </span>
                      <span className="text-lg font-bold text-gray-200">
                        {currency.symbol}
                        {budget.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-3 mb-3 overflow-hidden p-0.5 border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExceeded
                          ? "bg-gradient-to-r from-rose-600 to-rose-400 shadow-lg shadow-rose-500/50"
                          : isApproaching
                          ? "bg-gradient-to-r from-amber-600 to-amber-400 shadow-lg shadow-amber-500/50"
                          : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                      }`}
                      style={{
                        width: `${Math.min(percentSpent, 100)}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>
                      {isExceeded ? (
                        <strong className="text-rose-400">
                          Over budget by {currency.symbol}
                          {(budget.spent - budget.amount).toFixed(2)}
                        </strong>
                      ) : (
                        <span>
                          Remaining:{" "}
                          <strong className="text-emerald-400">
                            {currency.symbol}
                            {remaining.toFixed(2)}
                          </strong>
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-gray-300 bg-white/[0.06] px-2 py-0.5 rounded-md border border-white/5">
                      {percentSpent.toFixed(1)}% Used
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {budgets.length === 0 && (
          <div className="glass-card p-12 text-center border border-dashed border-white/20 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-yellow/10 text-yellow flex items-center justify-center mx-auto mb-4 border border-yellow/20">
              <PieChart className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              No Budgets Set for {formattedSelectedMonthName}
            </h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              Establish category spending limits to track progress for {formattedSelectedMonthName}.
            </p>
            <Button
              onClick={() => {
                setNewBudget((prev) => ({ ...prev, month: selectedMonth }));
                setIsAddingBudget(true);
              }}
              variant="primary"
              className="shadow-lg shadow-yellow/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Budget for {formattedSelectedMonthName}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Budget;
