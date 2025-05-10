import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../contexts/CurrencyContext';
import { FileSpreadsheet, File as FilePdf } from 'lucide-react';
import Button from '../components/common/Button';
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
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

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

const Reports = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const { currency } = useCurrency();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const endDate = new Date();
    const startDate = subMonths(endDate, getMonthsFromRange(dateRange));

    // Fetch expenses with categories
    const { data: expensesData } = await supabase
      .from('expenses')
      .select(`
        id,
        amount,
        date,
        expense_category_mappings!inner (
          expense_categories (
            name,
            color
          )
        )
      `)
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (expensesData) {
      const formattedExpenses = expensesData.map(expense => ({
        ...expense,
        category: expense.expense_category_mappings[0].expense_categories
      }));
      setExpenses(formattedExpenses);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(formattedExpenses.map(expense => expense.category.name))
      );
      setCategories(uniqueCategories);
    }

    // Fetch incomes
    const { data: incomesData } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (incomesData) {
      setIncomes(incomesData);
    }
  };

  const getMonthsFromRange = (range: string): number => {
    switch (range) {
      case '3M': return 3;
      case '6M': return 6;
      case '1Y': return 12;
      default: return 1;
    }
  };

  const filterExpenses = () => {
    return expenses.filter(expense => {
      const categoryMatch = selectedCategories.length === 0 || 
        selectedCategories.includes(expense.category.name);
      const amountMatch = (!minAmount || expense.amount >= parseFloat(minAmount)) &&
        (!maxAmount || expense.amount <= parseFloat(maxAmount));
      return categoryMatch && amountMatch;
    });
  };

  const getMonthlyData = () => {
    const monthlyExpenses = new Map<string, number>();
    const monthlyIncome = new Map<string, number>();
    const monthlySavings = new Map<string, number>();

    // Initialize maps with all months in range
    const months = getMonthsFromRange(dateRange);
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, windowWidth < 640 ? 'MMM yy' : 'MMM yyyy');
      monthlyExpenses.set(monthKey, 0);
      monthlyIncome.set(monthKey, 0);
      monthlySavings.set(monthKey, 0);
    }

    // Calculate expenses
    filterExpenses().forEach(expense => {
      const monthKey = format(parseISO(expense.date), windowWidth < 640 ? 'MMM yy' : 'MMM yyyy');
      if (monthlyExpenses.has(monthKey)) {
        monthlyExpenses.set(
          monthKey,
          monthlyExpenses.get(monthKey)! + expense.amount
        );
      }
    });

    // Calculate income and savings
    incomes.forEach(income => {
      if (!income.is_holiday) {
        const monthKey = format(parseISO(income.date), windowWidth < 640 ? 'MMM yy' : 'MMM yyyy');
        if (monthlyIncome.has(monthKey)) {
          const amount = income.in_hand_amount || income.amount;
          monthlyIncome.set(monthKey, monthlyIncome.get(monthKey)! + amount);
          monthlySavings.set(
            monthKey,
            monthlyIncome.get(monthKey)! - monthlyExpenses.get(monthKey)!
          );
        }
      }
    });

    return {
      labels: Array.from(monthlyExpenses.keys()),
      expenses: Array.from(monthlyExpenses.values()),
      income: Array.from(monthlyIncome.values()),
      savings: Array.from(monthlySavings.values()),
    };
  };

  const getCategoryData = () => {
    const categoryTotals = new Map<string, number>();
    
    filterExpenses().forEach(expense => {
      const current = categoryTotals.get(expense.category.name) || 0;
      categoryTotals.set(expense.category.name, current + expense.amount);
    });

    return {
      labels: Array.from(categoryTotals.keys()),
      data: Array.from(categoryTotals.values()),
      colors: filterExpenses()
        .filter((expense, index, self) => 
          index === self.findIndex(e => e.category.name === expense.category.name)
        )
        .map(expense => expense.category.color),
    };
  };

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();

  const lineChartData = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Income',
        data: monthlyData.income,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Expenses',
        data: monthlyData.expenses,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Savings',
        data: monthlyData.savings,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4,
      },
    ],
  };

  const pieChartData = {
    labels: categoryData.labels,
    datasets: [
      {
        data: categoryData.data,
        backgroundColor: categoryData.colors,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: windowWidth < 640 ? 'bottom' as const : 'top' as const,
        labels: {
          boxWidth: windowWidth < 640 ? 12 : 40,
          font: {
            size: windowWidth < 640 ? 10 : 12
          }
        }
      },
      tooltip: {
        bodyFont: {
          size: windowWidth < 640 ? 10 : 12
        },
        titleFont: {
          size: windowWidth < 640 ? 12 : 14
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${currency.symbol}${value}`,
          font: {
            size: windowWidth < 640 ? 10 : 12
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: windowWidth < 640 ? 10 : 12
          }
        }
      }
    },
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Monthly Summary Sheet
    const monthlySheet = [
      ['Month', 'Income', 'Expenses', 'Savings'],
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
      'Monthly Summary'
    );

    // Category Summary Sheet
    const categorySheet = [
      ['Category', 'Total Amount'],
      ...categoryData.labels.map((category, i) => [
        category,
        `${currency.symbol}${categoryData.data[i].toFixed(2)}`,
      ]),
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(categorySheet),
      'Category Summary'
    );

    XLSX.writeFile(workbook, 'Financial_Report.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Financial Report', 20, 20);
    
    let yPos = 40;
    
    // Monthly Summary
    doc.setFontSize(16);
    doc.text('Monthly Summary', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    monthlyData.labels.forEach((month, i) => {
      doc.text(`${month}:`, 20, yPos);
      doc.text(`Income: ${currency.symbol}${monthlyData.income[i].toFixed(2)}`, 60, yPos);
      doc.text(`Expenses: ${currency.symbol}${monthlyData.expenses[i].toFixed(2)}`, 120, yPos);
      doc.text(`Savings: ${currency.symbol}${monthlyData.savings[i].toFixed(2)}`, 180, yPos);
      yPos += 10;
      
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    yPos += 10;
    
    // Category Summary
    doc.setFontSize(16);
    doc.text('Category Summary', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    categoryData.labels.forEach((category, i) => {
      doc.text(`${category}: ${currency.symbol}${categoryData.data[i].toFixed(2)}`, 20, yPos);
      yPos += 10;
      
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    doc.save('Financial_Report.pdf');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold">Reports</h1>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={exportToExcel}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              Export Excel
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <FilePdf className="w-5 h-5 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="1M">Last Month</option>
              <option value="3M">Last 3 Months</option>
              <option value="6M">Last 6 Months</option>
              <option value="1Y">Last Year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categories</label>
            <select
              multiple
              value={selectedCategories}
              onChange={(e) => {
                const values = Array.from(
                  e.target.selectedOptions,
                  option => option.value
                );
                setSelectedCategories(values);
              }}
              className="w-full px-3 py-2 border rounded"
              size={3}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Min Amount</label>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder={`${currency.symbol}0.00`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Max Amount</label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder={`${currency.symbol}1000.00`}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Monthly Overview</h2>
            <div className="h-[300px] sm:h-[400px]">
              <Line
                data={lineChartData}
                options={chartOptions}
              />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Expense by Category</h2>
            <div className="h-[300px] sm:h-[400px]">
              <Pie
                data={pieChartData}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      ...chartOptions.plugins.legend,
                      position: 'right',
                      align: windowWidth < 640 ? 'center' : 'center',
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <h3 className="text-base sm:text-lg font-semibold mb-2">Total Income</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-500">
              {currency.symbol}
              {monthlyData.income.reduce((a, b) => a + b, 0).toFixed(2)}
            </p>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <h3 className="text-base sm:text-lg font-semibold mb-2">Total Expenses</h3>
            <p className="text-2xl sm:text-3xl font-bold text-red-500">
              {currency.symbol}
              {monthlyData.expenses.reduce((a, b) => a + b, 0).toFixed(2)}
            </p>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <h3 className="text-base sm:text-lg font-semibold mb-2">Net Savings</h3>
            <p className="text-2xl sm:text-3xl font-bold text-blue-500">
              {currency.symbol}
              {monthlyData.savings.reduce((a, b) => a + b, 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;