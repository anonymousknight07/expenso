import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Calendar,
  Plus,
  Tag,
  Trash2,
  X,
  FileSpreadsheet,
  File as FilePdf,
  Share2,
  AlertTriangle,
  Edit,
  Zap,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  Filter,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RotateCcw,
} from "lucide-react";
import Button from "../components/common/Button";
import { useCurrency } from "../contexts/CurrencyContext";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  categories: Category[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface BudgetAlert {
  id: string;
  budget_id: string;
  type: "warning" | "exceeded";
  created_at: string;
  acknowledged: boolean;
}

const DEFAULT_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEEAD",
  "#D4A5A5",
  "#9B59B6",
  "#3498DB",
  "#E67E22",
  "#2ECC71",
];

const Expenses = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const { currency, calculateEffectiveIncome } = useCurrency();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [effectiveIncome, setEffectiveIncome] = useState(0);
  const [exceededBudgets, setExceededBudgets] = useState<
    {
      categoryName: string;
      amount: number;
      spent: number;
    }[]
  >([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    categories: [] as string[],
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    color: DEFAULT_COLORS[0],
  });

  const updateEffectiveIncome = async () => {
    const income = await calculateEffectiveIncome();
    setEffectiveIncome(income);
  };

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchAlerts();
    fetchExceededBudgets();
    updateEffectiveIncome();
  }, []);

  const changeMonth = (offset: number) => {
    const baseMonth =
      selectedMonth === "all"
        ? new Date().toISOString().slice(0, 7)
        : selectedMonth;
    const [year, month] = baseMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const fetchExceededBudgets = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const currentYearMonth = today.toISOString().slice(0, 7);
    const currentMonthFullDate = `${currentYearMonth}-01`;

    const { data: budgets, error } = await supabase
      .from("budgets")
      .select(
        `
      *,
      expense_categories (
        name
      )
    `
      )
      .eq("user_id", user.id)
      .eq("month", currentMonthFullDate);

    if (error) {
      console.error("Error fetching exceeded budgets:", error);
      return;
    }

    setExceededBudgets(
      (budgets || [])
        .filter((budget) => budget.spent > budget.amount)
        .map((budget) => ({
          categoryName: budget.expense_categories?.name ?? "Unknown",
          amount: budget.amount,
          spent: budget.spent,
        }))
    );
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

  const fetchExpenses = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select(
        `
        *,
        expense_category_mappings (
          category_id,
          expense_categories (
            id,
            name,
            color
          )
        )
      `
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError);
      return;
    }

    const formattedExpenses = expensesData.map((expense) => ({
      ...expense,
      categories: expense.expense_category_mappings
        .map((mapping: any) => mapping.expense_categories)
        .filter(Boolean),
    }));

    setExpenses(formattedExpenses);
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

  const filterExpenses = () => {
    let filtered = expenses;

    if (selectedMonth !== "all") {
      filtered = filtered.filter((expense) =>
        expense.date.startsWith(selectedMonth)
      );
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((expense) =>
        expense.categories.some((category) =>
          selectedCategories.includes(category.id)
        )
      );
    }

    return filtered;
  };

  const calculateTotalExpenses = () => {
    return filterExpenses().reduce(
      (total, expense) => total + expense.amount,
      0
    );
  };

  const calculateIncomeAfterExpenses = () => {
    return effectiveIncome - calculateTotalExpenses();
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .select(
          `
          *,
          expense_category_mappings (
            category_id
          )
        `
        )
        .eq("id", id)
        .single();

      if (expenseError) {
        console.error("Error fetching expense:", expenseError);
        return;
      }

      const expenseMonth = expense.date.slice(0, 7);
      const expenseMonthFullDate = `${expenseMonth}-01`;

      const categoryMappings = expense.expense_category_mappings || [];
      for (const mapping of categoryMappings) {
        const { data: budget, error: budgetError } = await supabase
          .from("budgets")
          .select("*")
          .eq("category_id", mapping.category_id)
          .eq("month", expenseMonthFullDate)
          .single();

        if (budgetError) {
          continue;
        }

        if (budget) {
          const newSpent = Math.max(0, budget.spent - expense.amount);
          await supabase
            .from("budgets")
            .update({ spent: newSpent })
            .eq("id", budget.id);
        }
      }

      await supabase
        .from("expense_category_mappings")
        .delete()
        .eq("expense_id", id);

      const { error: deleteError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error deleting expense:", deleteError);
        return;
      }

      await Promise.all([
        fetchExpenses(),
        fetchAlerts(),
        fetchExceededBudgets(),
      ]);
    } catch (error) {
      console.error("Unexpected error during expense deletion:", error);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setNewExpense({
      amount: expense.amount.toString(),
      description: expense.description,
      date: expense.date,
      categories: expense.categories.map((c) => c.id),
    });
    setIsAddingExpense(true);
  };

  const handleAddOrUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (editingExpenseId) {
        const { data: oldExpense, error: oldExpenseError } = await supabase
          .from("expenses")
          .select(
            `
            *,
            expense_category_mappings (
              category_id
            )
          `
          )
          .eq("id", editingExpenseId)
          .single();

        if (oldExpenseError) {
          console.error("Error fetching old expense:", oldExpenseError);
          return;
        }

        const oldAmount = oldExpense.amount;
        const newAmount = parseFloat(newExpense.amount);
        const oldDate = oldExpense.date;
        const newDate = newExpense.date;
        const oldCategoryIds = (
          oldExpense.expense_category_mappings || []
        ).map((m: any) => m.category_id);
        const newCategoryIds = newExpense.categories;

        const oldMonth = oldDate.slice(0, 7) + "-01";
        for (const categoryId of oldCategoryIds) {
          const { data: oldBudget, error: oldBudgetError } = await supabase
            .from("budgets")
            .select("*")
            .eq("category_id", categoryId)
            .eq("month", oldMonth)
            .single();

          if (!oldBudgetError && oldBudget) {
            const newSpent = Math.max(0, oldBudget.spent - oldAmount);
            await supabase
              .from("budgets")
              .update({ spent: newSpent })
              .eq("id", oldBudget.id);
          }
        }

        const { data: updatedExpense, error: updateExpenseError } =
          await supabase
            .from("expenses")
            .update({
              amount: newAmount,
              description: newExpense.description,
              date: newDate,
            })
            .eq("id", editingExpenseId)
            .select()
            .single();

        if (updateExpenseError) {
          console.error("Error updating expense:", updateExpenseError);
          return;
        }

        await supabase
          .from("expense_category_mappings")
          .delete()
          .eq("expense_id", editingExpenseId);

        if (newCategoryIds.length > 0) {
          const mappings = newCategoryIds.map((categoryId) => ({
            expense_id: updatedExpense.id,
            category_id: categoryId,
            user_id: user.id,
          }));

          await supabase.from("expense_category_mappings").insert(mappings);
        }

        const newMonth = newDate.slice(0, 7) + "-01";
        for (const categoryId of newCategoryIds) {
          const { data: budget, error: budgetError } = await supabase
            .from("budgets")
            .select("*")
            .eq("category_id", categoryId)
            .eq("month", newMonth)
            .single();

          if (!budgetError && budget) {
            const newSpent = budget.spent + newAmount;
            await supabase
              .from("budgets")
              .update({ spent: newSpent })
              .eq("id", budget.id);
          }
        }

        const expenseMonth = newDate.slice(0, 7);
        if (selectedMonth !== "all" && selectedMonth !== expenseMonth) {
          setSelectedMonth(expenseMonth);
        }

        setEditingExpenseId(null);
      } else {
        const { data: expense, error: expenseError } = await supabase
          .from("expenses")
          .insert([
            {
              amount: parseFloat(newExpense.amount),
              description: newExpense.description,
              date: newExpense.date,
              user_id: user.id,
            },
          ])
          .select()
          .single();

        if (expenseError) {
          console.error("Error adding expense:", expenseError);
          return;
        }

        if (newExpense.categories.length > 0) {
          const mappings = newExpense.categories.map((categoryId) => ({
            expense_id: expense.id,
            category_id: categoryId,
            user_id: user.id,
          }));

          const { error: mappingError } = await supabase
            .from("expense_category_mappings")
            .insert(mappings);

          if (mappingError) {
            await supabase.from("expenses").delete().eq("id", expense.id);
            return;
          }

          const expenseMonth = expense.date.slice(0, 7);
          const currentMonthFullDate = `${expenseMonth}-01`;

          for (const categoryId of newExpense.categories) {
            const { data: budget, error: budgetError } = await supabase
              .from("budgets")
              .select("*")
              .eq("category_id", categoryId)
              .eq("month", currentMonthFullDate)
              .single();

            if (!budgetError && budget) {
              const newSpent = budget.spent + parseFloat(newExpense.amount);

              await supabase
                .from("budgets")
                .update({ spent: newSpent })
                .eq("id", budget.id);
            }
          }
        }

        const expenseMonth = newExpense.date.slice(0, 7);
        if (selectedMonth !== "all" && selectedMonth !== expenseMonth) {
          setSelectedMonth(expenseMonth);
        }
      }

      setNewExpense({
        amount: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        categories: [],
      });
      setIsAddingExpense(false);
      await Promise.all([
        fetchExpenses(),
        fetchAlerts(),
        fetchExceededBudgets(),
      ]);
    } catch (error) {
      console.error("Unexpected error:", error);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from("expense_categories").insert([
      {
        name: newCategory.name,
        color: newCategory.color,
        user_id: user.id,
      },
    ]);

    if (error) {
      console.error("Error adding category:", error);
      return;
    }

    setNewCategory({
      name: "",
      color: DEFAULT_COLORS[0],
    });
    setIsAddingCategory(false);
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting category:", error);
      return;
    }

    setSelectedCategories((prev) => prev.filter((catId) => catId !== id));
    fetchCategories();
  };

  const groupExpensesByDate = () => {
    const grouped = new Map<string, Expense[]>();
    filterExpenses().forEach((expense) => {
      const date = expense.date;
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)?.push(expense);
    });
    return grouped;
  };

  const handleCalendarDayClick = (date: string) => {
    setNewExpense((prev) => ({
      ...prev,
      date,
    }));
    setIsAddingExpense(true);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const filteredExpenses = filterExpenses();

    const expensesByMonth = filteredExpenses.reduce((acc, expense) => {
      const date = new Date(expense.date);
      const monthYear = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }

      acc[monthYear].push({
        Date: expense.date,
        Description: expense.description,
        Amount: `${currency.symbol}${expense.amount.toFixed(2)}`,
        Categories: expense.categories.map((cat) => cat.name).join(", "),
      });

      return acc;
    }, {} as Record<string, any[]>);

    Object.entries(expensesByMonth).forEach(([monthYear, monthExpenses]) => {
      const worksheet = XLSX.utils.json_to_sheet(monthExpenses);

      const totalAmount = monthExpenses.reduce(
        (sum, exp) => sum + parseFloat(exp.Amount.replace(currency.symbol, "")),
        0
      );

      XLSX.utils.sheet_add_aoa(
        worksheet,
        [[`Total: ${currency.symbol}${totalAmount.toFixed(2)}`]],
        { origin: -1 }
      );

      XLSX.utils.book_append_sheet(workbook, worksheet, monthYear);
    });

    XLSX.writeFile(workbook, "Expenses.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const filteredExpenses = filterExpenses();

    doc.setFontSize(20);
    doc.text("Expense Report", 20, 20);

    let yPos = 40;
    const pageHeight = doc.internal.pageSize.height;

    const expensesByMonth = filteredExpenses.reduce((acc, expense) => {
      const date = new Date(expense.date);
      const monthYear = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }

      acc[monthYear].push(expense);
      return acc;
    }, {} as Record<string, Expense[]>);

    Object.entries(expensesByMonth).forEach(([monthYear, monthExpenses]) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.text(monthYear, 20, yPos);
      yPos += 10;

      const totalAmount = monthExpenses.reduce(
        (sum, exp) => sum + exp.amount,
        0
      );

      monthExpenses.forEach((expense) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        const text = `${expense.date}: ${expense.description}`;
        doc.text(text, 20, yPos);
        doc.text(`${currency.symbol}${expense.amount.toFixed(2)}`, 150, yPos);
        yPos += 7;

        if (expense.categories.length > 0) {
          doc.setFontSize(10);
          doc.text(
            expense.categories.map((cat) => cat.name).join(", "),
            30,
            yPos
          );
          yPos += 7;
        }
      });

      doc.setFontSize(14);
      doc.text(`Total: ${currency.symbol}${totalAmount.toFixed(2)}`, 20, yPos);
      yPos += 20;
    });

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    setShareUrl(pdfUrl);
    doc.save("Expenses.pdf");
  };

  const shareFile = (type: "whatsapp" | "email") => {
    if (type === "whatsapp") {
      window.open(
        `https://wa.me/?text=Check out my expense report: ${shareUrl}`
      );
    } else {
      window.location.href = `mailto:?subject=Expense Report&body=Check out my expense report: ${shareUrl}`;
    }
  };

  const currentSystemMonth = new Date().toISOString().slice(0, 7);

  const getMonthPeriodStatus = (month: string) => {
    if (month === "all") {
      return {
        label: "All Months",
        color: "bg-blue-500/10 text-blue-300 border-blue-500/30",
        isCurrent: false,
      };
    }
    if (month < currentSystemMonth) {
      return {
        label: "Past Month",
        color: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        isCurrent: false,
      };
    }
    if (month > currentSystemMonth) {
      return {
        label: "Coming Month",
        color: "bg-purple-500/10 text-purple-300 border-purple-500/30",
        isCurrent: false,
      };
    }
    return {
      label: "Current Month",
      color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      isCurrent: true,
    };
  };

  const monthStatus = getMonthPeriodStatus(selectedMonth);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-7xl">
      {/* Month Navigation Control Bar */}
      <div className="mb-6 glass-card p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border border-white/10 shadow-lg">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2.5 rounded-xl bg-yellow/10 text-yellow flex-shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              Expense Period Filter
            </h2>
            <p className="text-xs text-gray-400">
              View expenses for specific months or all time
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="month"
              value={selectedMonth === "all" ? "" : selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-[#1c1d23] text-white text-xs sm:text-sm font-semibold focus:border-yellow"
            />

            <button
              onClick={() => changeMonth(1)}
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border shadow-sm ${monthStatus.color}`}>
            {monthStatus.label}
          </span>

          <button
            onClick={() => setSelectedMonth("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedMonth === "all"
                ? "bg-yellow/20 border-yellow text-white shadow-md shadow-yellow/10"
                : "bg-white/[0.05] border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            All Months
          </button>

          {!monthStatus.isCurrent && selectedMonth !== "all" && (
            <button
              onClick={() => setSelectedMonth(currentSystemMonth)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/10 text-gray-200 border border-white/10 transition-all flex items-center gap-1.5"
              title="Switch to current system month"
            >
              <RotateCcw className="w-3.5 h-3.5 text-yellow" />
              <span>Go to Current Month</span>
            </button>
          )}
        </div>
      </div>

      {/* Exceeded Budgets Banner */}
      {exceededBudgets.length > 0 && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-rose-950/60 to-red-900/40 border border-rose-500/30 p-4 sm:p-5 backdrop-blur-xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 mt-0.5 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-rose-200">
                Budget Alert: Exceeded Categories
              </h3>
              <ul className="mt-1 space-y-1">
                {exceededBudgets.map((budget, index) => (
                  <li key={index} className="text-xs text-rose-300">
                    <strong className="text-white">
                      {budget.categoryName}:
                    </strong>{" "}
                    Spent {currency.symbol}
                    {budget.spent.toFixed(2)} of {currency.symbol}
                    {budget.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Link
            to="/budget"
            className="w-full md:w-auto text-center px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-all"
          >
            Review Budget
          </Link>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2 sm:gap-3 flex-wrap">
              Expense Tracking
              <span className="text-xs px-2.5 py-1 rounded-full bg-yellow/10 text-yellow border border-yellow/20 font-medium">
                {selectedMonth === "all" ? "All Time" : selectedMonth}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${monthStatus.color}`}>
                {monthStatus.label}
              </span>
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Log, categorize, and analyze your daily transactions effortlessly
            </p>
          </div>

          {/* Action Toolbar Grid for Mobile & Desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() =>
                setViewMode(viewMode === "list" ? "calendar" : "list")
              }
              className="px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>{viewMode === "list" ? "Calendar" : "List"}</span>
            </button>

            <button
              onClick={() => navigate("/upi-sync")}
              className="px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>UPI Sync</span>
            </button>

            <button
              onClick={exportToExcel}
              className="px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              onClick={exportToPDF}
              className="px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <FilePdf className="w-4 h-4 text-rose-400" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="col-span-1 sm:col-span-1 px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>Share</span>
            </button>

            <Button
              onClick={() => {
                setEditingExpenseId(null);
                setNewExpense({
                  amount: "",
                  description: "",
                  date: new Date().toISOString().split("T")[0],
                  categories: [],
                });
                setIsAddingExpense(true);
              }}
              variant="primary"
              className="col-span-1 sm:col-span-1 shadow-lg shadow-yellow/20 justify-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* 3 Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="glass-card p-5 sm:p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm font-medium text-gray-400">
                Monthly Income
              </span>
              <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
              {currency.symbol}
              {effectiveIncome.toFixed(2)}
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-2 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              In-hand earnings available
            </p>
          </div>

          <div className="glass-card p-5 sm:p-6 relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm font-medium text-gray-400">
                Total Expenses (
                {selectedMonth === "all" ? "All Time" : selectedMonth})
              </span>
              <div className="p-2 sm:p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 tracking-tight">
              {currency.symbol}
              {calculateTotalExpenses().toFixed(2)}
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-2">
              Across {filterExpenses().length} records logged
            </p>
          </div>

          <div className="glass-card p-5 sm:p-6 sm:col-span-2 lg:col-span-1 relative overflow-hidden group hover:border-sky-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm font-medium text-gray-400">
                Net Remaining Balance
              </span>
              <div
                className={`p-2 sm:p-2.5 rounded-xl ${
                  calculateIncomeAfterExpenses() >= 0
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                }`}
              >
                <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                calculateIncomeAfterExpenses() >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {currency.symbol}
              {calculateIncomeAfterExpenses().toFixed(2)}
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-2">
              Income minus filtered total expenses
            </p>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-modal p-5 sm:p-6 w-full max-w-md border border-white/10 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-400" />
                Share Expense Report
              </h2>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => shareFile("whatsapp")}
                className="w-full py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                Share via WhatsApp
              </button>
              <button
                onClick={() => shareFile("email")}
                className="w-full py-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                Share via Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Chips Section */}
      <div className="mb-8 glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-yellow" />
            <h2 className="text-sm sm:text-base font-bold text-white">
              Filter by Category
            </h2>
          </div>
          <button
            onClick={() => setIsAddingCategory(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/10 border border-white/10 text-gray-200 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-yellow" />
            New Category
          </button>
        </div>

        <div className="flex flex-wrap gap-2 max-h-44 sm:max-h-none overflow-y-auto pr-1">
          <button
            onClick={() => setSelectedCategories([])}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
              selectedCategories.length === 0
                ? "bg-yellow/20 border-yellow text-white shadow-md shadow-yellow/10"
                : "bg-white/[0.04] border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            All ({filterExpenses().length})
          </button>

          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.id);
            return (
              <div
                key={category.id}
                className="relative group inline-flex items-center"
              >
                <button
                  onClick={() => {
                    setSelectedCategories((prev) =>
                      prev.includes(category.id)
                        ? prev.filter((id) => id !== category.id)
                        : [...prev, category.id]
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border flex items-center gap-1.5"
                  style={{
                    backgroundColor: isSelected
                      ? `${category.color}33`
                      : "rgba(255,255,255,0.04)",
                    borderColor: isSelected
                      ? category.color
                      : "rgba(255,255,255,0.1)",
                    color: isSelected ? "#ffffff" : "#9ca3af",
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="truncate max-w-[120px]">
                    {category.name}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(category.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-400 transition-all ml-0.5"
                  title="Delete category"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Category Modal */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-modal p-5 sm:p-6 w-full max-w-md border border-white/10 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-yellow" />
                Add Category
              </h2>
              <button
                onClick={() => setIsAddingCategory(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  placeholder="e.g. Groceries, Utility"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Pick Accent Color
                </label>
                <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, color })}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 transition-transform ${
                        newCategory.color === color
                          ? "border-white scale-110 shadow-lg"
                          : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={() => setIsAddingCategory(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-modal p-5 sm:p-6 w-full max-w-md border border-white/10 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-5">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-yellow" />
                {editingExpenseId ? "Edit Expense" : "Log New Expense"}
              </h2>
              <button
                onClick={() => {
                  setIsAddingExpense(false);
                  setEditingExpenseId(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddOrUpdateExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Amount ({currency.symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, amount: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-base sm:text-lg font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Description
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) =>
                    setNewExpense({
                      ...newExpense,
                      description: e.target.value,
                    })
                  }
                  placeholder="e.g. Dinner, Rent"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-300">
                  Date
                </label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, date: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Assign Categories
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {categories.map((category) => {
                    const isSelected = newExpense.categories.includes(
                      category.id
                    );
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setNewExpense((prev) => ({
                            ...prev,
                            categories: prev.categories.includes(category.id)
                              ? prev.categories.filter(
                                  (id) => id !== category.id
                                )
                              : [...prev.categories, category.id],
                          }));
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border"
                        style={{
                          backgroundColor: isSelected
                            ? category.color
                            : "rgba(255,255,255,0.05)",
                          borderColor: isSelected
                            ? category.color
                            : "rgba(255,255,255,0.1)",
                          color: isSelected ? "#ffffff" : "#9ca3af",
                        }}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={() => {
                    setIsAddingExpense(false);
                    setEditingExpenseId(null);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {editingExpenseId ? "Save Changes" : "Create Expense"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Expense Content (List / Calendar) */}
      {viewMode === "list" ? (
        <div className="space-y-4 sm:space-y-6">
          {Array.from(groupExpensesByDate()).map(([date, dayExpenses]) => {
            const dayTotal = dayExpenses.reduce(
              (sum, exp) => sum + exp.amount,
              0
            );

            return (
              <div
                key={date}
                className="glass-card p-4 sm:p-5 border border-white/10 hover:border-white/20 transition-all shadow-xl"
              >
                <div className="flex justify-between items-center mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-yellow flex-shrink-0" />
                    <h3 className="font-bold text-white text-xs sm:text-base">
                      {new Date(date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </h3>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 sm:py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    Total: {currency.symbol}
                    {dayTotal.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-3">
                  {dayExpenses.map((expense: Expense) => (
                    <div
                      key={expense.id}
                      className="glass-inset p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-white/20 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between sm:justify-start gap-2">
                          <span className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                            {currency.symbol}
                            {expense.amount.toFixed(2)}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-gray-200 truncate max-w-full">
                            {expense.description}
                          </span>
                        </div>

                        {expense.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {expense.categories.map((category) => (
                              <span
                                key={category.id}
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                                style={{
                                  backgroundColor: `${category.color}22`,
                                  borderColor: `${category.color}44`,
                                  color: category.color,
                                }}
                              >
                                {category.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0">
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="p-2 rounded-xl bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 text-sky-400 hover:text-sky-300 transition-colors"
                          title="Edit expense"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-2 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 border border-white/10 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filterExpenses().length === 0 && (
            <div className="glass-card p-8 sm:p-12 text-center border border-dashed border-white/20 rounded-2xl">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-yellow/10 text-yellow flex items-center justify-center mx-auto mb-4 border border-yellow/20">
                <CreditCard className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                No Expenses Logged for{" "}
                {selectedMonth === "all" ? "All Time" : selectedMonth}
              </h3>
              <p className="text-gray-400 text-xs sm:text-sm max-w-md mx-auto mb-6">
                Add an expense or select a different month to view
                transactions.
              </p>
              <Button
                onClick={() => setIsAddingExpense(true)}
                variant="primary"
                className="shadow-lg shadow-yellow/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Expense
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card p-4 sm:p-6 overflow-x-auto">
          {(() => {
            const activeMonthStr =
              selectedMonth === "all"
                ? new Date().toISOString().slice(0, 7)
                : selectedMonth;

            const [yearStr, monthStr] = activeMonthStr.split("-");
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);

            const firstDayObj = new Date(year, month - 1, 1);
            const firstDayOfWeek = firstDayObj.getDay();
            const daysInMonth = new Date(year, month, 0).getDate();
            const totalCells = firstDayOfWeek + daysInMonth > 35 ? 42 : 35;
            const todayStr = new Date().toISOString().split("T")[0];

            return (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 pb-3 border-b border-white/10 gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-yellow" />
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {firstDayObj.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      Calendar
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow" />
                      Active Month
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                      Other Month
                    </span>
                  </div>
                </div>

                <p className="sm:hidden text-[11px] text-gray-400 mb-3 flex items-center gap-1">
                  💡 Scroll horizontally to view full calendar grid
                </p>

                <div className="min-w-[650px]">
                  <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-3 text-center text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div key={day} className="py-1.5 sm:py-2 glass-inset">
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  <div className="grid grid-cols-7 gap-2 sm:gap-3">
                    {Array.from({ length: totalCells }, (_, i) => {
                      const date = new Date(year, month - 1, 1);
                      date.setDate(i - firstDayOfWeek + 1);

                      const cellYear = date.getFullYear();
                      const cellMonthNum = date.getMonth() + 1;
                      const cellDayNum = date.getDate();

                      const dateStr = `${cellYear}-${String(
                        cellMonthNum
                      ).padStart(2, "0")}-${String(cellDayNum).padStart(
                        2,
                        "0"
                      )}`;

                      const isCurrentSelectedMonth =
                        cellYear === year && cellMonthNum === month;
                      const isToday = dateStr === todayStr;

                      const dayExpenses = filterExpenses().filter(
                        (e) => e.date === dateStr
                      );
                      const totalAmount = dayExpenses.reduce(
                        (sum, exp) => sum + exp.amount,
                        0
                      );

                      return (
                        <div
                          key={i}
                          onClick={() => handleCalendarDayClick(dateStr)}
                          className={`p-2 sm:p-3 rounded-2xl border min-h-[85px] sm:min-h-[95px] cursor-pointer hover:border-yellow/60 transition-all flex flex-col justify-between ${
                            !isCurrentSelectedMonth
                              ? "opacity-30 bg-white/[0.01] border-white/5"
                              : dayExpenses.length > 0
                              ? "bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-yellow/30 shadow-md"
                              : isToday
                              ? "bg-yellow/10 border-yellow/50"
                              : "bg-white/[0.02] border-white/10"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            {isToday && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-yellow text-black uppercase">
                                Today
                              </span>
                            )}
                            <span
                              className={`text-xs font-bold ml-auto ${
                                !isCurrentSelectedMonth
                                  ? "text-gray-600"
                                  : isToday
                                  ? "text-yellow"
                                  : "text-gray-300"
                              }`}
                            >
                              {cellDayNum}
                            </span>
                          </div>

                          {dayExpenses.length > 0 && (
                            <div className="mt-1">
                              <div
                                className={`text-[11px] sm:text-xs font-extrabold ${
                                  !isCurrentSelectedMonth
                                    ? "text-yellow/50"
                                    : "text-yellow"
                                }`}
                              >
                                {currency.symbol}
                                {totalAmount.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {dayExpenses.length} rec
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default Expenses;
