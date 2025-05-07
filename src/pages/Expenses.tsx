import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, Tag, Trash2, Edit } from 'lucide-react';
import Button from '../components/common/Button';

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

const DEFAULT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
  '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
];

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [newExpense, setNewExpense] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categories: [] as string[]
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    color: DEFAULT_COLORS[0]
  });
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, []);

  const fetchExpenses = async () => {
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_category_mappings (
          expense_categories (
            id,
            name,
            color
          )
        )
      `)
      .order('date', { ascending: false });

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
      return;
    }

    const formattedExpenses = expensesData.map(expense => ({
      ...expense,
      categories: expense.expense_category_mappings.map(
        (mapping: any) => mapping.expense_categories
      )
    }));

    setExpenses(formattedExpenses);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert([{
        amount: parseFloat(newExpense.amount),
        description: newExpense.description,
        date: newExpense.date,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }])
      .select()
      .single();

    if (expenseError) {
      console.error('Error adding expense:', expenseError);
      return;
    }

    if (newExpense.categories.length > 0) {
      const mappings = newExpense.categories.map(categoryId => ({
        expense_id: expense.id,
        category_id: categoryId
      }));

      const { error: mappingError } = await supabase
        .from('expense_category_mappings')
        .insert(mappings);

      if (mappingError) {
        console.error('Error adding category mappings:', mappingError);
      }
    }

    setNewExpense({
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      categories: []
    });
    setIsAddingExpense(false);
    fetchExpenses();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('expense_categories')
      .insert([{ 
        name: newCategory.name,
        color: newCategory.color,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }]);

    if (error) {
      console.error('Error adding category:', error);
      return;
    }

    setNewCategory({
      name: '',
      color: DEFAULT_COLORS[0]
    });
    setIsAddingCategory(false);
    fetchCategories();
  };

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting expense:', error);
      return;
    }

    fetchExpenses();
  };

  const filterExpenses = () => {
    if (selectedCategories.length === 0) return expenses;

    return expenses.filter(expense =>
      expense.categories.some(category =>
        selectedCategories.includes(category.id)
      )
    );
  };

  const groupExpensesByDate = () => {
    const grouped = new Map();
    filterExpenses().forEach(expense => {
      const date = expense.date;
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date).push(expense);
    });
    return grouped;
  };

  const handleCalendarDayClick = (date: string) => {
    setNewExpense(prev => ({
      ...prev,
      date
    }));
    setIsAddingExpense(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Expenses</h1>
        <div className="flex gap-4">
          <Button
            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            variant="outline"
          >
            <Calendar className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setIsAddingExpense(true)}
            variant="primary"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Categories Section */}
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
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => {
                setSelectedCategories(prev =>
                  prev.includes(category.id)
                    ? prev.filter(id => id !== category.id)
                    : [...prev, category.id]
                )
              }}
              className={`px-3 py-1 rounded-full text-sm flex items-center gap-2`}
              style={{
                backgroundColor: selectedCategories.includes(category.id)
                  ? category.color
                  : `${category.color}33`,
                color: selectedCategories.includes(category.id) ? 'white' : 'black'
              }}
            >
              <Tag className="w-4 h-4" />
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add Category Modal */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Category</h2>
            <form onSubmit={handleAddCategory}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Category name"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newCategory.color === color ? 'border-black' : 'border-transparent'
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

      {/* Add Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Expense</h2>
            <form onSubmit={handleAddExpense}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
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
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setNewExpense(prev => ({
                          ...prev,
                          categories: prev.categories.includes(category.id)
                            ? prev.categories.filter(id => id !== category.id)
                            : [...prev.categories, category.id]
                        }))
                      }}
                      className={`px-3 py-1 rounded-full text-sm flex items-center gap-2`}
                      style={{
                        backgroundColor: newExpense.categories.includes(category.id)
                          ? category.color
                          : `${category.color}33`,
                        color: newExpense.categories.includes(category.id) ? 'white' : 'black'
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
                  onClick={() => setIsAddingExpense(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expenses List/Calendar View */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {Array.from(groupExpensesByDate()).map(([date, dayExpenses]) => (
            <div key={date} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">{new Date(date).toLocaleDateString()}</h3>
              <div className="space-y-3">
                {dayExpenses.map((expense: Expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">${expense.amount.toFixed(2)}</p>
                      <p className="text-gray-600">{expense.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {expense.categories.map(category => (
                          <span
                            key={category.id}
                            className="px-2 py-1 rounded-full text-xs"
                            style={{
                              backgroundColor: `${category.color}33`,
                              color: 'black'
                            }}
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-7 gap-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-medium">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - date.getDay() + i);
              const dateStr = date.toISOString().split('T')[0];
              const dayExpenses = expenses.filter(e => e.date === dateStr);
              const totalAmount = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
              
              return (
                <div
                  key={i}
                  onClick={() => handleCalendarDayClick(dateStr)}
                  className={`p-2 border rounded min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors ${
                    dayExpenses.length > 0 ? 'bg-yellow/10' : ''
                  }`}
                >
                  <div className="text-right text-sm text-gray-600">
                    {date.getDate()}
                  </div>
                  {dayExpenses.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-medium text-black">
                        ${totalAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dayExpenses.length} expense{dayExpenses.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;