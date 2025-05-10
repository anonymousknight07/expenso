import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, FileSpreadsheet, File as FilePdf } from 'lucide-react';
import Button from '../components/common/Button';
import { useCurrency } from '../contexts/CurrencyContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

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

const Budget = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [effectiveIncome, setEffectiveIncome] = useState<number>(0);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
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
    updateEffectiveIncome();
  }, []);

  const fetchBudgets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-31`;

    const { data, error } = await supabase
      .from('budgets')
      .select(`
        *,
        category:expense_categories(*)
      `)
      .eq('user_id', user.id)
      .gte('month', startDate)
      .lte('month', endDate);

    if (error) {
      console.error('Error fetching budgets:', error);
      return;
    }

    setBudgets(data || []);
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
    fetchBudgets();
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold">Budget</h1>
          <div className="flex flex-wrap gap-4">
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
                  <h3 className="text-lg font-semibold">{budget.category.name}</h3>
                  <span className="text-lg font-semibold">
                    {currency.symbol}{budget.amount.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      (budget.spent / budget.amount) > 1 ? 'bg-red-500' :
                      (budget.spent / budget.amount) > budget.notification_threshold ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((budget.spent / budget.amount) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-600">
                  <span>Spent: {currency.symbol}{budget.spent.toFixed(2)}</span>
                  <span>Remaining: {currency.symbol}{(budget.amount - budget.spent).toFixed(2)}</span>
                  <span>{((budget.spent / budget.amount) * 100).toFixed(1)}%</span>
                </div>
                {budget.spent >= budget.amount * budget.notification_threshold && (
                  <div className={`mt-2 text-sm ${budget.spent > budget.amount ? 'text-red-500' : 'text-yellow-500'}`}>
                    {budget.spent > budget.amount
                      ? '⚠️ Budget exceeded!'
                      : '⚠️ Approaching budget limit!'}
                  </div>
                )}
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
      </div>
    </div>
  );
};

export default Budget;