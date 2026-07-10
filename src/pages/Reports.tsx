import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  FileSpreadsheet,
  File as FilePdf,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CalendarDays,
  Award,
  AlertTriangle,
  Ban,
  Crown,
  Receipt,
} from "lucide-react";
import Button from "../components/common/Button";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { format, parseISO, subMonths, differenceInCalendarDays } from "date-fns";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Dark-theme chart defaults
ChartJS.defaults.color = "#b3b3b3";
ChartJS.defaults.borderColor = "rgba(255, 255, 255, 0.08)";

interface Expense {
  id: string;
  amount: number;
  date: string;
  category: { name: string; color: string };
}

interface Income {
  id: string;
  amount: number;
  in_hand_amount: number;
  date: string;
  is_holiday: boolean;
}

interface Insight {
  icon: React.ElementType;
  tone: "good" | "warn" | "neutral";
  text: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Reports = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<"1M" | "3M" | "6M" | "1Y">("3M");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const { currency } = useCurrency();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const endDate = new Date();
    const startDate = subMonths(endDate, getMonthsFromRange(dateRange));

    const { data: expensesData } = await supabase
      .from("expenses")
      .select(`
        id,
        amount,
        date,
        expense_category_mappings (
          expense_categories (
            name,
            color
          )
        )
      `)
      .eq("user_id", user.id)
      .gte("date", startDate.toISOString())
      .lte("date", endDate.toISOString());

    if (expensesData) {
      const formattedExpenses = expensesData.map((expense: any) => {
        const mapping = Array.isArray(expense.expense_category_mappings)
          ? expense.expense_category_mappings[0]
          : expense.expense_category_mappings;
        const cat = Array.isArray(mapping?.expense_categories)
          ? mapping.expense_categories[0]
          : mapping?.expense_categories;
        return {
          ...expense,
          category: cat ?? { name: "Uncategorized", color: "#7f7e83" },
        };
      });
      setExpenses(formattedExpenses);

      const uniqueCategories = Array.from(
        new Set(formattedExpenses.map((expense: Expense) => expense.category.name))
      ) as string[];
      setCategories(uniqueCategories);
    }

    const { data: incomesData } = await supabase
      .from("income")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate.toISOString())
      .lte("date", endDate.toISOString());

    if (incomesData) {
      setIncomes(incomesData);
    }
  };

  const getMonthsFromRange = (range: string): number => {
    switch (range) {
      case "3M": return 3;
      case "6M": return 6;
      case "1Y": return 12;
      default: return 1;
    }
  };

  const filterExpenses = () => {
    return expenses.filter((expense) => {
      const categoryMatch =
        selectedCategories.length === 0 ||
        selectedCategories.includes(expense.category.name);
      const amountMatch =
        (!minAmount || expense.amount >= parseFloat(minAmount)) &&
        (!maxAmount || expense.amount <= parseFloat(maxAmount));
      return categoryMatch && amountMatch;
    });
  };

  const getMonthlyData = () => {
    const monthlyExpenses = new Map<string, number>();
    const monthlyIncome = new Map<string, number>();

    const months = getMonthsFromRange(dateRange);
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, windowWidth < 640 ? "MMM yy" : "MMM yyyy");
      monthlyExpenses.set(monthKey, 0);
      monthlyIncome.set(monthKey, 0);
    }

    filterExpenses().forEach((expense) => {
      const monthKey = format(parseISO(expense.date), windowWidth < 640 ? "MMM yy" : "MMM yyyy");
      if (monthlyExpenses.has(monthKey)) {
        monthlyExpenses.set(monthKey, monthlyExpenses.get(monthKey)! + expense.amount);
      }
    });

    incomes.forEach((income) => {
      if (!income.is_holiday) {
        const monthKey = format(parseISO(income.date), windowWidth < 640 ? "MMM yy" : "MMM yyyy");
        if (monthlyIncome.has(monthKey)) {
          const amount = income.in_hand_amount || income.amount;
          monthlyIncome.set(monthKey, monthlyIncome.get(monthKey)! + amount);
        }
      }
    });

    const labels = Array.from(monthlyExpenses.keys());
    const expensesArr = Array.from(monthlyExpenses.values());
    const incomeArr = Array.from(monthlyIncome.values());
    const savingsArr = labels.map((_, i) => incomeArr[i] - expensesArr[i]);

    return { labels, expenses: expensesArr, income: incomeArr, savings: savingsArr };
  };

  const getCategoryData = () => {
    const categoryTotals = new Map<string, { amount: number; color: string }>();

    filterExpenses().forEach((expense) => {
      const current = categoryTotals.get(expense.category.name);
      categoryTotals.set(expense.category.name, {
        amount: (current?.amount || 0) + expense.amount,
        color: expense.category.color,
      });
    });

    const sorted = Array.from(categoryTotals.entries()).sort(
      (a, b) => b[1].amount - a[1].amount
    );

    return {
      labels: sorted.map(([name]) => name),
      data: sorted.map(([, v]) => v.amount),
      colors: sorted.map(([, v]) => v.color),
    };
  };

  const getWeekdayData = () => {
    const totals = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    filterExpenses().forEach((expense) => {
      const day = parseISO(expense.date).getDay();
      totals[day] += expense.amount;
      counts[day] += 1;
    });
    return { totals, counts };
  };

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();
  const weekdayData = getWeekdayData();

  const totalIncome = monthlyData.income.reduce((a, b) => a + b, 0);
  const totalExpenses = monthlyData.expenses.reduce((a, b) => a + b, 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  /* ---------- Smart Summary: plain-English insights computed from the data ---------- */

  const buildInsights = (): { grade: string; gradeTone: string; insights: Insight[] } => {
    const insights: Insight[] = [];
    const filtered = filterExpenses();
    const rangeDays = Math.max(
      1,
      differenceInCalendarDays(new Date(), subMonths(new Date(), getMonthsFromRange(dateRange)))
    );

    // Health grade from savings rate
    let grade = "No data yet";
    let gradeTone = "text-gray-400";
    if (totalIncome > 0 || totalExpenses > 0) {
      if (savingsRate >= 30) { grade = "Excellent"; gradeTone = "text-emerald-400"; }
      else if (savingsRate >= 20) { grade = "Great"; gradeTone = "text-emerald-400"; }
      else if (savingsRate >= 10) { grade = "Good"; gradeTone = "text-yellow-300"; }
      else if (savingsRate >= 0) { grade = "Needs attention"; gradeTone = "text-amber-400"; }
      else { grade = "At risk"; gradeTone = "text-red-400"; }
    }

    if (totalIncome > 0) {
      insights.push({
        icon: PiggyBank,
        tone: savingsRate >= 20 ? "good" : savingsRate >= 0 ? "neutral" : "warn",
        text:
          savingsRate >= 0
            ? `You saved ${savingsRate}% of your income (${currency.symbol}${netSavings.toFixed(0)}) in this period${savingsRate >= 20 ? " — ahead of the recommended 20%." : ". The common target is 20%."}`
            : `You spent ${currency.symbol}${Math.abs(netSavings).toFixed(0)} more than you earned in this period — worth a closer look at the top categories below.`,
      });
    }

    if (categoryData.labels.length > 0 && totalExpenses > 0) {
      const share = Math.round((categoryData.data[0] / totalExpenses) * 100);
      insights.push({
        icon: Crown,
        tone: share >= 40 ? "warn" : "neutral",
        text: `"${categoryData.labels[0]}" is your biggest spending category — ${currency.symbol}${categoryData.data[0].toFixed(0)} (${share}% of all spending).`,
      });
    }

    if (filtered.length > 0) {
      const biggest = filtered.reduce((max, e) => (e.amount > max.amount ? e : max), filtered[0]);
      insights.push({
        icon: Receipt,
        tone: "neutral",
        text: `Your single largest expense was ${currency.symbol}${biggest.amount.toFixed(0)} (${biggest.category.name}) on ${format(parseISO(biggest.date), "d MMM")}.`,
      });

      const avgDaily = totalExpenses / rangeDays;
      insights.push({
        icon: CalendarDays,
        tone: "neutral",
        text: `On average you spend ${currency.symbol}${avgDaily.toFixed(0)} per day, across ${filtered.length} transactions.`,
      });

      const peakDay = weekdayData.totals.indexOf(Math.max(...weekdayData.totals));
      if (weekdayData.totals[peakDay] > 0) {
        insights.push({
          icon: TrendingUp,
          tone: "neutral",
          text: `${WEEKDAYS[peakDay]}s are your most expensive day — ${currency.symbol}${weekdayData.totals[peakDay].toFixed(0)} spent in total. Plan ahead for them.`,
        });
      }

      const spendDates = new Set(filtered.map((e) => e.date.slice(0, 10)));
      const noSpendDays = Math.max(0, rangeDays - spendDates.size);
      if (noSpendDays > 0) {
        insights.push({
          icon: Ban,
          tone: "good",
          text: `${noSpendDays} no-spend day${noSpendDays > 1 ? "s" : ""} in this period — every one of them is money kept.`,
        });
      }
    }

    // Month-over-month trend (needs at least 2 months of data)
    const n = monthlyData.labels.length;
    if (n >= 2 && monthlyData.expenses[n - 2] > 0) {
      const change = Math.round(
        ((monthlyData.expenses[n - 1] - monthlyData.expenses[n - 2]) /
          monthlyData.expenses[n - 2]) * 100
      );
      if (change !== 0) {
        insights.push({
          icon: change > 0 ? AlertTriangle : Award,
          tone: change > 0 ? "warn" : "good",
          text:
            change > 0
              ? `Spending is up ${change}% in ${monthlyData.labels[n - 1]} vs ${monthlyData.labels[n - 2]}.`
              : `Nice work — spending is down ${Math.abs(change)}% in ${monthlyData.labels[n - 1]} vs ${monthlyData.labels[n - 2]}.`,
        });
      }
      const bestIdx = monthlyData.savings.indexOf(Math.max(...monthlyData.savings));
      if (monthlyData.savings[bestIdx] > 0) {
        insights.push({
          icon: Award,
          tone: "good",
          text: `${monthlyData.labels[bestIdx]} was your best month — you saved ${currency.symbol}${monthlyData.savings[bestIdx].toFixed(0)}.`,
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        icon: Sparkles,
        tone: "neutral",
        text: "Add some expenses and income to unlock personalised insights here.",
      });
    }

    return { grade, gradeTone, insights };
  };

  const { grade, gradeTone, insights } = buildInsights();

  /* ---------- chart configs ---------- */

  const lineChartData = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: "Income",
        data: monthlyData.income,
        borderColor: "#34d399",
        backgroundColor: "rgba(52, 211, 153, 0.12)",
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#34d399",
      },
      {
        label: "Expenses",
        data: monthlyData.expenses,
        borderColor: "#f87171",
        backgroundColor: "rgba(248, 113, 113, 0.12)",
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#f87171",
      },
      {
        label: "Savings",
        data: monthlyData.savings,
        borderColor: "#fa7041",
        backgroundColor: "rgba(250, 112, 65, 0.10)",
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#fa7041",
      },
    ],
  };

  const doughnutData = {
    labels: categoryData.labels,
    datasets: [
      {
        data: categoryData.data,
        backgroundColor: categoryData.colors,
        borderColor: "rgba(10, 10, 11, 0.6)",
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const weekdayChartData = {
    labels: windowWidth < 640 ? ["S", "M", "T", "W", "T", "F", "S"] : WEEKDAYS.map((d) => d.slice(0, 3)),
    datasets: [
      {
        label: "Spent",
        data: weekdayData.totals,
        backgroundColor: weekdayData.totals.map((v) =>
          v === Math.max(...weekdayData.totals) && v > 0
            ? "rgba(255, 60, 2, 0.85)"
            : "rgba(250, 112, 65, 0.35)"
        ),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const topCategoriesData = {
    labels: categoryData.labels.slice(0, 5),
    datasets: [
      {
        label: "Spent",
        data: categoryData.data.slice(0, 5),
        backgroundColor: categoryData.colors.slice(0, 5).map((c) => `${c}cc`),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: windowWidth < 640 ? ("bottom" as const) : ("top" as const),
        labels: {
          boxWidth: windowWidth < 640 ? 12 : 24,
          usePointStyle: true,
          font: { size: windowWidth < 640 ? 10 : 12 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(28, 29, 35, 0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: 10,
        bodyFont: { size: windowWidth < 640 ? 10 : 12 },
        titleFont: { size: windowWidth < 640 ? 12 : 14 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: {
          callback: (value: any) => `${currency.symbol}${value}`,
          font: { size: windowWidth < 640 ? 10 : 12 },
        },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: windowWidth < 640 ? 10 : 12 } },
      },
    },
  };

  const noLegend = {
    ...baseOptions,
    plugins: { ...baseOptions.plugins, legend: { display: false } },
  };

  const horizontalBarOptions = {
    ...noLegend,
    indexAxis: "y" as const,
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: {
          callback: (value: any) => `${currency.symbol}${value}`,
          font: { size: windowWidth < 640 ? 10 : 12 },
        },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: windowWidth < 640 ? 10 : 12 } },
      },
    },
  };

  /* ---------- exports ---------- */

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const highlightsSheet = [
      ["Financial Report — Highlights"],
      [`Financial health: ${grade} (savings rate ${savingsRate}%)`],
      [],
      ...insights.map((i) => [i.text]),
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(highlightsSheet),
      "Highlights"
    );

    const monthlySheet = [
      ["Month", "Income", "Expenses", "Savings"],
      ...monthlyData.labels.map((month, i) => [
        month,
        `${currency.symbol}${monthlyData.income[i].toFixed(2)}`,
        `${currency.symbol}${monthlyData.expenses[i].toFixed(2)}`,
        `${currency.symbol}${monthlyData.savings[i].toFixed(2)}`,
      ]),
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(monthlySheet),
      "Monthly Summary"
    );

    const categorySheet = [
      ["Category", "Total Amount"],
      ...categoryData.labels.map((category, i) => [
        category,
        `${currency.symbol}${categoryData.data[i].toFixed(2)}`,
      ]),
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(categorySheet),
      "Category Summary"
    );

    XLSX.writeFile(workbook, "Financial_Report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Financial Report", 20, 20);

    let yPos = 32;

    doc.setFontSize(14);
    doc.text(`Financial health: ${grade} — savings rate ${savingsRate}%`, 20, yPos);
    yPos += 12;

    doc.setFontSize(15);
    doc.text("Highlights", 20, yPos);
    yPos += 8;
    doc.setFontSize(11);
    insights.forEach((insight) => {
      const lines = doc.splitTextToSize(`• ${insight.text}`, 170);
      lines.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 6;
        if (yPos > 270) { doc.addPage(); yPos = 20; }
      });
      yPos += 1;
    });

    yPos += 8;
    doc.setFontSize(15);
    doc.text("Monthly Summary", 20, yPos);
    yPos += 8;

    doc.setFontSize(11);
    monthlyData.labels.forEach((month, i) => {
      doc.text(`${month}:`, 20, yPos);
      doc.text(`Income: ${currency.symbol}${monthlyData.income[i].toFixed(2)}`, 55, yPos);
      doc.text(`Expenses: ${currency.symbol}${monthlyData.expenses[i].toFixed(2)}`, 110, yPos);
      doc.text(`Savings: ${currency.symbol}${monthlyData.savings[i].toFixed(2)}`, 165, yPos);
      yPos += 7;
      if (yPos > 270) { doc.addPage(); yPos = 20; }
    });

    yPos += 8;
    doc.setFontSize(15);
    doc.text("Category Summary", 20, yPos);
    yPos += 8;

    doc.setFontSize(11);
    categoryData.labels.forEach((category, i) => {
      doc.text(`${category}: ${currency.symbol}${categoryData.data[i].toFixed(2)}`, 20, yPos);
      yPos += 7;
      if (yPos > 270) { doc.addPage(); yPos = 20; }
    });

    doc.save("Financial_Report.pdf");
  };

  const toneClasses: Record<Insight["tone"], string> = {
    good: "bg-emerald-500/15 text-emerald-400",
    warn: "bg-amber-500/15 text-amber-400",
    neutral: "bg-sky-500/15 text-sky-400",
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-slate-300 mt-1 text-sm">
              Your money, explained — not just charted.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Range pills */}
            <div className="glass-chip p-1 flex items-center">
              {(["1M", "3M", "6M", "1Y"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    dateRange === range
                      ? "accent-gradient text-white shadow-md shadow-yellow/30"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <Button onClick={exportToExcel} variant="outline" size="sm">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <FilePdf className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Smart Summary */}
        <div className="glass-card p-6 bg-gradient-to-br from-yellow/10 via-transparent to-transparent">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-64 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <h2 className="text-lg font-semibold">Smart Summary</h2>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Auto-generated from your data — updates with the filters.
              </p>
              <div className="glass-inset p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Financial health
                </p>
                <p className={`text-2xl font-bold ${gradeTone}`}>{grade}</p>
                <div className="w-full h-1.5 bg-white/15 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full accent-gradient rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(4, savingsRate + 30))}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{savingsRate}% savings rate</p>
              </div>
            </div>
            <div className="flex-1 grid sm:grid-cols-2 gap-3">
              {insights.map((insight, i) => (
                <div key={i} className="glass-inset p-3.5 flex items-start gap-3">
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${toneClasses[insight.tone]}`}
                  >
                    <insight.icon className="w-4 h-4" />
                  </span>
                  <p className="text-sm text-slate-200 leading-snug">{insight.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-gray-300">Total Income</h3>
            </div>
            <p className="text-2xl font-bold text-white">
              {currency.symbol}
              {totalIncome.toFixed(2)}
            </p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-medium text-gray-300">Total Expenses</h3>
            </div>
            <p className="text-2xl font-bold text-white">
              {currency.symbol}
              {totalExpenses.toFixed(2)}
            </p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-medium text-gray-300">Net Savings</h3>
            </div>
            <p className={`text-2xl font-bold ${netSavings >= 0 ? "text-white" : "text-red-400"}`}>
              {currency.symbol}
              {netSavings.toFixed(2)}
            </p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="w-4 h-4 text-yellow-300" />
              <h3 className="text-sm font-medium text-gray-300">Savings Rate</h3>
            </div>
            <p
              className={`text-2xl font-bold ${
                savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 0 ? "text-yellow-300" : "text-red-400"
              }`}
            >
              {savingsRate}%
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card p-5">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Filter by category</label>
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 && (
                  <span className="text-sm text-gray-500">No categories in this period</span>
                )}
                {categories.map((category) => {
                  const active = selectedCategories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() =>
                        setSelectedCategories((prev) =>
                          active ? prev.filter((c) => c !== category) : [...prev, category]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        active
                          ? "accent-gradient text-white border-transparent shadow-md shadow-yellow/25"
                          : "glass-chip text-slate-300 hover:text-white border-white/10"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Min amount</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-28 px-3 py-2 text-sm"
                  placeholder={`${currency.symbol}0`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max amount</label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-28 px-3 py-2 text-sm"
                  placeholder={`${currency.symbol}1000`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-1">Cash Flow</h2>
            <p className="text-xs text-gray-400 mb-4">Income vs expenses vs savings, month by month</p>
            <div className="h-[300px] sm:h-[340px]">
              <Line data={lineChartData} options={baseOptions} />
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-1">Where It Goes</h2>
            <p className="text-xs text-gray-400 mb-4">Share of spending by category</p>
            <div className="h-[300px] sm:h-[340px]">
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "62%",
                  plugins: {
                    legend: {
                      position: windowWidth < 1024 ? ("bottom" as const) : ("right" as const),
                      labels: { usePointStyle: true, boxWidth: 10, font: { size: 11 } },
                    },
                    tooltip: baseOptions.plugins.tooltip,
                  },
                }}
              />
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-1">Spending Rhythm</h2>
            <p className="text-xs text-gray-400 mb-4">
              Which day of the week costs you the most (highlighted)
            </p>
            <div className="h-[260px] sm:h-[300px]">
              <Bar data={weekdayChartData} options={noLegend} />
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-1">Top 5 Categories</h2>
            <p className="text-xs text-gray-400 mb-4">Your biggest budget lines, ranked</p>
            <div className="h-[260px] sm:h-[300px]">
              <Bar data={topCategoriesData} options={horizontalBarOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
