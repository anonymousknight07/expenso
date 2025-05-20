import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, FileSpreadsheet, File as FilePdf, BellOff, Bell } from 'lucide-react';
import Button from '../components/common/Button';
import { useCurrency } from '../contexts/CurrencyContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { toast } from 'react-hot-toast';

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

interface Expense {
  id: string;
  category_id: string;
  amount: number;
  date: string;
}

const Budget = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [effectiveIncome, setEffectiveIncome] = useState<number>(0);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const { currency, calculateEffectiveIncome } = useCurrency();

  const [newBudget, setNewBudget] = useState({
    category_id: '',
    amount: '',
    month: new Date().toISOString().slice(0, 7),
    notification_threshold: 0.75,
  });

  const updateEffectiveIncome = async () => {
    const income = await calculateEffectiveIncome();
    setEffectiveIncome(income);
  };

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
    fetchAlerts();
    updateEffectiveIncome();

    // Set up a subscription to listen for changes to the expenses table
    const expensesChannel = supabase
      .channel('expenses_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'expenses' 
      }, (payload) => {
        console.log('Expense changed:', payload);
        // When expenses change, update the budgets to reflect new spending
        fetchBudgetsWithSpent();
      })
      .subscribe();

    // Also listen for changes to the budgets table itself
    const budgetsChannel = supabase
      .channel('budgets_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'budgets'
      }, (payload) => {
        console.log('Budget changed:', payload);
        fetchBudgetsWithSpent();
      })
      .subscribe();

    // Force initial fetch with a small delay to ensure everything is loaded
    const initialFetchTimer = setTimeout(() => {
      console.log("Performing initial forced fetch");
      fetchBudgetsWithSpent();
    }, 1000);

    return () => {
      // Clean up subscriptions when component unmounts
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(budgetsChannel);
      clearTimeout(initialFetchTimer);
    };
  }, []);

  // Check for budgets that need alerts after data is loaded
  useEffect(() => {
    if (budgets.length > 0) {
      checkBudgetAlerts();
    }
  }, [budgets]);

  // This improved function fetches budgets AND calculates the actual spent amount
  const fetchBudgetsWithSpent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const startDate = `${currentMonth}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().slice(0, 10);
    
    console.log("Fetching budgets and expenses for date range:", startDate, "to", endDate);

    // First, get all the budgets
    const { data: budgetsData, error: budgetsError } = await supabase
      .from('budgets')
      .select(`
        *,
        category:expense_categories(*)
      `)
      .eq('user_id', user.id);
      // Note: Removed the .eq('month', startDate) - budgets month format might be different

    if (budgetsError) {
      console.error('Error fetching budgets:', budgetsError);
      return;
    }

    console.log("Fetched budgets:", budgetsData);

    if (!budgetsData || budgetsData.length === 0) {
      setBudgets([]);
      return;
    }

    // Filter budgets for the current month client-side to handle potential date format issues
    const currentMonthBudgets = budgetsData.filter(budget => {
      // Extract YYYY-MM from the budget month regardless of the full format
      const budgetMonth = budget.month.substring(0, 7);
      return budgetMonth === currentMonth;
    });

    console.log("Current month budgets:", currentMonthBudgets);

    // Now get all expenses for this month
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate);

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
      return;
    }

    console.log("Fetched expenses for date range:", expensesData);

    // Calculate spent amount for each budget
    const updatedBudgets = currentMonthBudgets.map(budget => {
      const categoryExpenses = expensesData?.filter(expense => 
        expense.category_id === budget.category_id
      ) || [];
      
      console.log(`Expenses for category ${budget.category.name}:`, categoryExpenses);
      
      const spentAmount = categoryExpenses.reduce((total, expense) => 
        total + (typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount)), 0);
      
      console.log(`Total spent for ${budget.category.name}:`, spentAmount);
      
      return {
        ...budget,
        spent: spentAmount
      };
    });

    console.log("Updated budgets with spent amounts:", updatedBudgets);
    setBudgets(updatedBudgets);
  };

  const fetchBudgets = async () => {
    // Replace with the improved function
    fetchBudgetsWithSpent();
  };

  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data || []);
  };

  const fetchAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from('budget_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
      return;
    }

    setAlerts(data || []);
  };

  const checkBudgetAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Check each budget for threshold or exceeded condition
    for (const budget of budgets) {
      const spendRatio = budget.spent / budget.amount;
      const isExceeded = spendRatio > 1;
      const isApproaching = spendRatio >= budget.notification_threshold && spendRatio <= 1;
      
      if (isExceeded || isApproaching) {
        // Check if an alert already exists for this condition
        const alertType = isExceeded ? 'exceeded' : 'approaching';
        
        const { data: existingAlerts } = await supabase
          .from('budget_alerts')
          .select('*')
          .eq('budget_id', budget.id)
          .eq('type', alertType)
          .eq('acknowledged', false);
        
        // If no alert exists, create one
        if (!existingAlerts || existingAlerts.length === 0) {
          const { error } = await supabase
            .from('budget_alerts')
            .insert([{
              user_id: user.id,
              budget_id: budget.id,
              type: alertType,
              acknowledged: false
            }]);
          
          if (error) {
            console.error('Error creating budget alert:', error);
          } else {
            // Show a toast notification
            toast.error(
              `${isExceeded ? 'Budget exceeded' : 'Approaching budget limit'}: ${budget.category.name}`, 
              { duration: 5000 }
            );
            
            // Refresh alerts
            fetchAlerts();
          }
        }
      }
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('budget_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId);

    if (error) {
      console.error('Error acknowledging alert:', error);
      return;
    }

    // Remove from local state
    setAlerts(alerts.filter(alert => alert.id !== alertId));
  };

  const handleAcknowledgeAllAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from('budget_alerts')
      .update({ acknowledged: true })
      .eq('user_id', user.id)
      .eq('acknowledged', false);

    if (error) {
      console.error('Error acknowledging all alerts:', error);
      return;
    }

    // Clear local state
    setAlerts([]);
    setShowAlerts(false);
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const monthDate = `${newBudget.month}-01`;

    const { error } = await supabase
      .from('budgets')
      .insert([{
        category_id: newBudget.category_id,
        amount: parseFloat(newBudget.amount),
        month: monthDate,
        notification_threshold: newBudget.notification_threshold,
        spent: 0,
        user_id: user.id
      }]);

    if (error) {
      console.error('Error adding budget:', error);
      return;
    }

    setNewBudget({
      category_id: '',
      amount: '',
      month: new Date().toISOString().slice(0, 7),
      notification_threshold: 0.75,
    });
    setIsAddingBudget(false);
    fetchBudgetsWithSpent();
  };

  const handleDeleteBudget = async (id: string) => {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting budget:', error);
      return;
    }

    fetchBudgets();
  };

  const calculateTotalBudget = () => {
    return budgets.reduce((total, budget) => total + budget.amount, 0);
  };

  const calculateSavings = () => {
    return effectiveIncome - calculateTotalBudget();
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    const data = budgets.map(budget => ({
      Category: budget.category.name,
      'Budget Amount': `${currency.symbol}${budget.amount.toFixed(2)}`,
      'Spent Amount': `${currency.symbol}${budget.spent.toFixed(2)}`,
      'Remaining': `${currency.symbol}${(budget.amount - budget.spent).toFixed(2)}`,
      'Progress': `${((budget.spent / budget.amount) * 100).toFixed(1)}%`,
      'Alert Threshold': `${(budget.notification_threshold * 100).toFixed(0)}%`
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    XLSX.utils.sheet_add_aoa(worksheet, [
      [`Monthly Income: ${currency.symbol}${effectiveIncome.toFixed(2)}`],
      [`Total Budget: ${currency.symbol}${calculateTotalBudget().toFixed(2)}`],
      [`Savings: ${currency.symbol}${calculateSavings().toFixed(2)}`]
    ], { origin: -1 });
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Budget Report');
    XLSX.writeFile(workbook, 'Budget.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Budget Report', 20, 20);
    
    let yPos = 40;
    
    doc.setFontSize(14);
    doc.text(`Monthly Income: ${currency.symbol}${effectiveIncome.toFixed(2)}`, 20, yPos);
    yPos += 10;
    doc.text(`Total Budget: ${currency.symbol}${calculateTotalBudget().toFixed(2)}`, 20, yPos);
    yPos += 10;
    doc.text(`Savings: ${currency.symbol}${calculateSavings().toFixed(2)}`, 20, yPos);
    yPos += 20;

    doc.setFontSize(12);
    budgets.forEach(budget => {
      doc.text(budget.category.name, 20, yPos);
      doc.text(`${currency.symbol}${budget.amount.toFixed(2)}`, 100, yPos);
      doc.text(`${((budget.spent / budget.amount) * 100).toFixed(1)}%`, 150, yPos);
      yPos += 10;
    });

    doc.save('Budget.pdf');
  };

  const getBudgetForAlert = (alertBudgetId: string) => {
    const budget = budgets.find(budget => budget.id === alertBudgetId);
    if (!budget) return null;
    
    // Ensure budget has category property
    if (!budget.category) {
      const category = categories.find(cat => cat.id === budget.category_id);
      if (category) {
        return {
          ...budget,
          category
        };
      }
    }
    
    return budget;
  };

  const handleManualRefresh = () => {
    console.log("Manual refresh requested");
    fetchBudgetsWithSpent();
    fetchAlerts();
    toast.success("Budget data refreshed");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold">Budget</h1>
          <div className="flex flex-wrap gap-4">
            <div className="relative">
              <Button
                onClick={() => setShowAlerts(!showAlerts)}
                variant="outline"
                className="relative"
              >
                {alerts.length > 0 ? <Bell className="w-5 h-5 mr-2" /> : <BellOff className="w-5 h-5 mr-2" />}
                Alerts
                {alerts.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                    {alerts.length}
                  </span>
                )}
              </Button>
              
              {/* Alerts Dropdown */}
              {showAlerts && alerts.length > 0 && (
                <div className="absolute right-0 mt-2 w-64 md:w-80 bg-white rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b flex justify-between items-center">
                    <h3 className="font-semibold">Budget Alerts</h3>
                    <button 
                      onClick={handleAcknowledgeAllAlerts}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Dismiss All
                    </button>
                  </div>
                  <div className="p-2">
                    {alerts.map(alert => {
                      const budget = getBudgetForAlert(alert.budget_id);
                      if (!budget) return null;
                      
                      return (
                        <div key={alert.id} className="p-2 border-b last:border-none">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{budget.category.name}</p>
                              <p className="text-sm text-gray-600">
                                {alert.type === 'exceeded' ? 'Budget exceeded!' : 'Approaching limit'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {currency.symbol}{budget.spent.toFixed(2)} of {currency.symbol}{budget.amount.toFixed(2)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <Button
              onClick={handleManualRefresh}
              variant="outline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-5 h-5 mr-2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                <path d="M16 16h5v5"></path>
              </svg>
              Refresh
            </Button>
            
            <Button
              onClick={exportToExcel}
              variant="outline"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              Export Excel
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
            >
              <FilePdf className="w-5 h-5 mr-2" />
              Export PDF
            </Button>
            <Button
              onClick={() => setIsAddingBudget(true)}
              variant="primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Budget
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Monthly Income</h2>
            <p className="text-3xl font-bold text-green-500">
              {currency.symbol}{effectiveIncome.toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Total Budget</h2>
            <p className="text-3xl font-bold text-blue-500">
              {currency.symbol}{calculateTotalBudget().toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Savings</h2>
            <p className={`text-3xl font-bold ${calculateSavings() >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {currency.symbol}{calculateSavings().toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Add Budget Modal */}
      {isAddingBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Budget</h2>
            <form onSubmit={handleAddBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={newBudget.category_id}
                  onChange={(e) => setNewBudget({...newBudget, category_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount ({currency.symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget({...newBudget, amount: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Month</label>
                <input
                  type="month"
                  value={newBudget.month}
                  onChange={(e) => setNewBudget({...newBudget, month: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Alert Threshold (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newBudget.notification_threshold * 100}
                  onChange={(e) => setNewBudget({...newBudget, notification_threshold: parseInt(e.target.value) / 100})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  You'll be notified when spending reaches this percentage of your budget
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsAddingBudget(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Budget
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budgets List */}
      <div className="space-y-4">
        {budgets.map(budget => (
          <div key={budget.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">
                    {budget.category.name}
                    {budget.spent > budget.amount && (
                      <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded">
                        Exceeded
                      </span>
                    )}
                    {budget.spent >= budget.amount * budget.notification_threshold && budget.spent <= budget.amount && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded">
                        Approaching Limit
                      </span>
                    )}
                  </h3>
                  <span className="text-lg font-semibold">
                    {currency.symbol}{budget.amount.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      budget.spent > budget.amount 
                        ? 'bg-red-500' 
                        : budget.spent >= budget.amount * budget.notification_threshold 
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min((budget.spent / budget.amount) * 100, 100)}%`,
                      transition: 'width 0.3s ease-in-out'
                    }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-600">
                  <span>Spent: {currency.symbol}{budget.spent.toFixed(2)}</span>
                  <span>Remaining: {currency.symbol}{Math.max(budget.amount - budget.spent, 0).toFixed(2)}</span>
                  <span>{((budget.spent / budget.amount) * 100).toFixed(1)}%</span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteBudget(budget.id)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        
        {budgets.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No budgets set for this month. Add your first budget to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Budget;

