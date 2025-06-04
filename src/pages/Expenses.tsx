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
  Menu,
  AlertTriangle,
  Edit,
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

interface Budget {
  amount: number;
  category_id: string;
  month: string;
  spent: number;
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
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const { currency, calculateEffectiveIncome } = useCurrency();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [showBudgetAlert, setShowBudgetAlert] = useState(false);
  const [budgetAlertType, setBudgetAlertType] = useState<
    "warning" | "exceeded"
  >("warning");
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [effectiveIncome, setEffectiveIncome] = useState(0);
  const [exceededBudgets, setExceededBudgets] = useState<
    {
      categoryName: string;
      amount: number;
      spent: number;
    }[]
  >([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null); // New state for editing

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

  const fetchExceededBudgets = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Change the date format to include the day (first day of month)
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
      .eq("month", currentMonthFullDate) // Use full date here
      .gt("spent", "amount");

    if (error) {
      console.error("Error fetching exceeded budgets:", error);
      return;
    }

    setExceededBudgets(
      budgets.map((budget) => ({
        categoryName: budget.expense_categories.name,
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

  const acknowledgeAlert = async (alertId: string) => {
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

  const calculateTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
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
          expense_category_mappings!inner (
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

      const expenseMonth = new Date(expense.date).toISOString().slice(0, 7);
      const expenseMonthFullDate = `${expenseMonth}-01`;

      for (const mapping of expense.expense_category_mappings) {
        const { data: budget, error: budgetError } = await supabase
          .from("budgets")
          .select("*")
          .eq("category_id", mapping.category_id)
          .eq("month", expenseMonthFullDate) // Use full date here instead of expenseMonth
          .single();

        if (budgetError) {
          console.error("Error fetching budget:", budgetError);
          continue;
        }

        if (budget) {
          const newSpent = Math.max(0, budget.spent - expense.amount);
          const { error: updateError } = await supabase
            .from("budgets")
            .update({ spent: newSpent })
            .eq("id", budget.id);

          if (updateError) {
            console.error("Error updating budget:", updateError);
          }

          if (newSpent < budget.amount * budget.notification_threshold) {
            const { error: alertDeleteError } = await supabase
              .from("budget_alerts")
              .delete()
              .eq("budget_id", budget.id)
              .eq("acknowledged", false);

            if (alertDeleteError) {
              console.error("Error deleting alerts:", alertDeleteError);
            }
          }
        }
      }

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

  // Function to handle editing an expense
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
        // Update existing expense
        // Step 1: Fetch the old expense data
        const { data: oldExpense, error: oldExpenseError } = await supabase
          .from("expenses")
          .select(
            `
            *,
            expense_category_mappings!inner (
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
        const oldCategoryIds = oldExpense.expense_category_mappings.map(
          (m: any) => m.category_id
        );
        const newCategoryIds = newExpense.categories;

        // Step 2: Revert old expense from budgets
        const oldMonth = new Date(oldDate).toISOString().slice(0, 7) + "-01";
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

        // Step 3: Update the expense
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

        // Step 4: Update category mappings
        // Delete old mappings
        await supabase
          .from("expense_category_mappings")
          .delete()
          .eq("expense_id", editingExpenseId);

        // Create new mappings
        if (newCategoryIds.length > 0) {
          const mappings = newCategoryIds.map((categoryId) => ({
            expense_id: updatedExpense.id,
            category_id: categoryId,
            user_id: user.id,
          }));

          const { error: mappingError } = await supabase
            .from("expense_category_mappings")
            .insert(mappings);

          if (mappingError) {
            console.error("Error updating category mappings:", mappingError);
          }
        }

        // Step 5: Apply new expense to budgets
        const newMonth = new Date(newDate).toISOString().slice(0, 7) + "-01";
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

        setEditingExpenseId(null);
      } else {
        // Add new expense (existing code)
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
            console.error("Error adding category mappings:", mappingError);
            await supabase.from("expenses").delete().eq("id", expense.id);
            return;
          }

          const currentMonth = new Date(expense.date).toISOString().slice(0, 7);
          const currentMonthFullDate = `${currentMonth}-01`; //

          for (const categoryId of newExpense.categories) {
            const { data: budget, error: budgetError } = await supabase
              .from("budgets")
              .select("*")
              .eq("category_id", categoryId)
              .eq("month", currentMonthFullDate) // Use full date here instead of currentMonth
              .single();
            if (!budgetError && budget) {
              const newSpent = budget.spent + parseFloat(newExpense.amount);

              await supabase
                .from("budgets")
                .update({ spent: newSpent })
                .eq("id", budget.id);

              if (newSpent >= budget.amount) {
                const { data: existingAlert } = await supabase
                  .from("budget_alerts")
                  .select("*")
                  .eq("budget_id", budget.id)
                  .eq("type", "exceeded")
                  .eq("acknowledged", false)
                  .single();

                if (!existingAlert) {
                  await supabase.from("budget_alerts").insert([
                    {
                      budget_id: budget.id,
                      type: "exceeded",
                      user_id: user.id,
                    },
                  ]);

                  if (
                    "Notification" in window &&
                    Notification.permission === "granted"
                  ) {
                    new Notification("Budget Alert", {
                      body: `You have exceeded the budget for this category!`,
                      icon: "/logo.png",
                    });
                  }
                }
              } else if (
                newSpent >=
                budget.amount * budget.notification_threshold
              ) {
                const { data: existingAlert } = await supabase
                  .from("budget_alerts")
                  .select("*")
                  .eq("budget_id", budget.id)
                  .eq("type", "warning")
                  .eq("acknowledged", false)
                  .single();

                if (!existingAlert) {
                  await supabase.from("budget_alerts").insert([
                    {
                      budget_id: budget.id,
                      type: "warning",
                      user_id: user.id,
                    },
                  ]);

                  if (
                    "Notification" in window &&
                    Notification.permission === "granted"
                  ) {
                    new Notification("Budget Warning", {
                      body: `You are approaching your budget limit!`,
                      icon: "/logo.png",
                    });
                  }
                }
              }
            }
          }
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

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel("budget-alerts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_alerts",
        },
        () => {
          fetchAlerts();
          fetchExceededBudgets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  const filterExpenses = () => {
    if (selectedCategories.length === 0) return expenses;

    return expenses.filter((expense) =>
      expense.categories.some((category) =>
        selectedCategories.includes(category.id)
      )
    );
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

  return (
    <div className="container mx-auto px-4 py-8">
      {exceededBudgets.length > 0 && (
        <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-red-700">
                Budget Alert
              </h3>
              <p className="text-red-600">
                You have exceeded the budget for the following categories:
              </p>
              <ul className="mt-2 space-y-1">
                {exceededBudgets.map((budget, index) => (
                  <li key={index} className="text-red-600">
                    {budget.categoryName}: Spent {currency.symbol}
                    {budget.spent.toFixed(2)} of {currency.symbol}
                    {budget.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              to="/budget"
              className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 transition-colors"
            >
              Review Budget
            </Link>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-8">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
                alert.type === "exceeded" ? "bg-red-100" : "bg-yellow-100"
              }`}
            >
              <div className="flex items-center">
                <AlertTriangle
                  className={`w-5 h-5 ${
                    alert.type === "exceeded"
                      ? "text-red-500"
                      : "text-yellow-500"
                  } mr-2`}
                />
                <span>
                  {alert.type === "exceeded"
                    ? "You have exceeded your budget!"
                    : "You are approaching your budget limit!"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => navigate("/budget")}
                  variant="outline"
                  className="text-sm"
                >
                  View Budget
                </Button>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Expenses</h1>
            <button
              onClick={() => setShowActionButtons(!showActionButtons)}
              className="md:hidden bg-gray-100 p-2 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div
            className={`flex flex-col md:flex-row gap-2 ${
              showActionButtons ? "flex" : "hidden md:flex"
            }`}
          >
            <Button
              onClick={() =>
                setViewMode(viewMode === "list" ? "calendar" : "list")
              }
              variant="outline"
              className="w-full md:w-auto"
            >
              <Calendar className="w-5 h-5" />
              <span className="ml-2 md:hidden">Toggle View</span>
            </Button>
            <Button
              onClick={exportToExcel}
              variant="outline"
              className="w-full md:w-auto"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              Export Excel
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
              className="w-full md:w-auto"
            >
              <FilePdf className="w-5 h-5 mr-2" />
              Export PDF
            </Button>
            <Button
              onClick={() => setIsShareModalOpen(true)}
              variant="outline"
              className="w-full md:w-auto"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
            <Button
              onClick={() => setIsAddingExpense(true)}
              variant="primary"
              className="w-full md:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Total Income</h2>
            <p className="text-3xl font-bold text-green-500">
              {currency.symbol}
              {effectiveIncome.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">After leave deductions</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Total Expenses</h2>
            <p className="text-3xl font-bold text-red-500">
              {currency.symbol}
              {calculateTotalExpenses().toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">
              Income After Expenses
            </h2>
            <p
              className={`text-3xl font-bold ${
                calculateIncomeAfterExpenses() >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {currency.symbol}
              {calculateIncomeAfterExpenses().toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Share Report</h2>
            <div className="space-y-4">
              <Button
                onClick={() => shareFile("whatsapp")}
                variant="outline"
                className="w-full"
              >
                Share via WhatsApp
              </Button>
              <Button
                onClick={() => shareFile("email")}
                variant="outline"
                className="w-full"
              >
                Share via Email
              </Button>
              <Button
                onClick={() => setIsShareModalOpen(false)}
                variant="primary"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold">Categories</h2>
          <Button
            onClick={() => setIsAddingCategory(true)}
            variant="outline"
            className="text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setSelectedCategories((prev) =>
                  prev.includes(category.id)
                    ? prev.filter((id) => id !== category.id)
                    : [...prev, category.id]
                );
              }}
              className="px-3 py-1 rounded-full text-sm flex items-center gap-2 group relative"
              style={{
                backgroundColor: selectedCategories.includes(category.id)
                  ? category.color
                  : `${category.color}33`,
                color: selectedCategories.includes(category.id)
                  ? "white"
                  : "black",
              }}
            >
              <Tag className="w-4 h-4" />
              {category.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCategory(category.id);
                }}
                className="opacity-0 group-hover:opacity-100 ml-1 hover:text-red-500 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {isAddingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Category</h2>
            <form onSubmit={handleAddCategory}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  placeholder="Category name"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newCategory.color === color
                          ? "border-black"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsAddingCategory(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingExpenseId ? "Edit Expense" : "Add New Expense"}
            </h2>
            <form onSubmit={handleAddOrUpdateExpense}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
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
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
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
                  placeholder="Description"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setNewExpense((prev) => ({
                          ...prev,
                          categories: prev.categories.includes(category.id)
                            ? prev.categories.filter((id) => id !== category.id)
                            : [...prev.categories, category.id],
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-sm flex items-center gap-2`}
                      style={{
                        backgroundColor: newExpense.categories.includes(
                          category.id
                        )
                          ? category.color
                          : `${category.color}33`,
                        color: newExpense.categories.includes(category.id)
                          ? "white"
                          : "black",
                      }}
                    >
                      <Tag className="w-4 h-4" />
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
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
                  {editingExpenseId ? "Update Expense" : "Add Expense"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBudgetAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Budget Alert</h2>
            <p className="mb-4">
              {budgetAlertType === "exceeded"
                ? "You've exceeded the budget for this category. Would you like to proceed?"
                : "You're approaching the budget limit for this category."}
            </p>
            <div className="flex justify-end gap-2">
              {budgetAlertType === "exceeded" ? (
                <>
                  <Button
                    onClick={() => {
                      setShowBudgetAlert(false);
                      handleAddExpense(new Event("submit") as any);
                    }}
                    variant="outline"
                  >
                    Proceed Anyway
                  </Button>
                  <Button
                    onClick={() => {
                      setShowBudgetAlert(false);
                      navigate("/budget");
                    }}
                    variant="primary"
                  >
                    Adjust Budget
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setShowBudgetAlert(false)}
                  variant="primary"
                >
                  Okay
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === "list" ? (
        <div className="space-y-4">
          {Array.from(groupExpensesByDate()).map(([date, dayExpenses]) => (
            <div key={date} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">
                {new Date(date).toLocaleDateString()}
              </h3>
              <div className="space-y-3">
                {dayExpenses.map((expense: Expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-gray-50 rounded gap-3"
                  >
                    <div>
                      <p className="font-medium">
                        {currency.symbol}
                        {expense.amount.toFixed(2)}
                      </p>
                      <p className="text-gray-600">{expense.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {expense.categories.map((category) => (
                          <span
                            key={category.id}
                            className="px-2 py-1 rounded-full text-xs"
                            style={{
                              backgroundColor: `${category.color}33`,
                              color: "black",
                            }}
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEditExpense(expense)}
                        className="text-blue-500 hover:text-blue-600"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
          <div className="min-w-[768px]">
            <div className="grid grid-cols-7 gap-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center font-medium">
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - date.getDay() + i);
                const dateStr = date.toISOString().split("T")[0];
                const dayExpenses = expenses.filter((e) => e.date === dateStr);
                const totalAmount = dayExpenses.reduce(
                  (sum, exp) => sum + exp.amount,
                  0
                );

                return (
                  <div
                    key={i}
                    onClick={() => handleCalendarDayClick(dateStr)}
                    className={`p-2 border rounded min-h-[80px] cursor-pointer hover:bg-gray-50 transition-colors ${
                      dayExpenses.length > 0 ? "bg-yellow/10" : ""
                    }`}
                  >
                    <div className="text-right text-sm text-gray-600">
                      {date.getDate()}
                    </div>
                    {dayExpenses.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-medium text-black">
                          {currency.symbol}
                          {totalAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {dayExpenses.length} expense
                          {dayExpenses.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
