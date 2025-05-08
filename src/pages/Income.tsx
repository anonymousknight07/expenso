import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, Tag, Trash2, Edit, FileSpreadsheet, File as FilePdf, Share2 } from 'lucide-react';
import Button from '../components/common/Button';
import { useCurrency } from '../contexts/CurrencyContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

interface Income {
  id: string;
  amount: number;
  description: string;
  date: string;
  category_id: string;
  is_holiday: boolean;
  holiday_reason?: string;
  holiday_type?: 'leave' | 'festival';
  category: IncomeCategory;
}

interface IncomeCategory {
  id: string;
  name: string;
}
const FESTIVALS = {
  'Christmas': 'Merry Christmas! 🎄',
  'Diwali': 'Happy Diwali! 🪔',
  'Eid al-Fitr': 'Eid Mubarak! 🌙',
  'New Year': 'Happy New Year! 🎉',
  'Easter': 'Happy Easter! 🐰',
  'Hanukkah': 'Happy Hanukkah! 🕎',
  'Holi': 'Happy Holi! 🌈',
  'Chinese New Year': 'Happy Lunar New Year! 🧧',
  'Thanksgiving': 'Happy Thanksgiving! 🦃',
  'Halloween': 'Happy Halloween! 🎃',
  'Vesak': 'Happy Vesak! 🪷',
  'Nowruz': 'Happy Nowruz! 🌸',
  'Songkran': 'Happy Songkran! 💦',
  'Carnival': 'Enjoy Carnival! 🎭',
  'Oktoberfest': 'Prost! 🍺',
  'Kwanzaa': 'Joyous Kwanzaa! 🖤❤️💚',
  'Rosh Hashanah': 'Shanah Tovah! 🍎🍯',
  'Yom Kippur': 'G’mar Chatimah Tovah! ✡️',
  'Ramadan': 'Ramadan Kareem! 🌙',
  'Lunar New Year': 'Happy Lunar New Year! 🧧',
  'Mid-Autumn Festival': 'Happy Mid-Autumn Festival! 🌕',
  'Pongal': 'Happy Pongal! 🌾',
  'Vaisakhi': 'Happy Vaisakhi! 🏵️',
  'Bastille Day': 'Bonne Fête Nationale! 🇫🇷',
  'St. Patrick’s Day': 'Happy St. Patrick’s Day! ☘️',
  'Mardi Gras': 'Happy Mardi Gras! 🎭',
  'La Tomatina': 'Enjoy La Tomatina! 🍅',
  'Gion Matsuri': 'Happy Gion Matsuri! 🎐',
  'Obon': 'Happy Obon! 🏮',
  'Chuseok': 'Happy Chuseok! 🌕',
  'Loi Krathong': 'Happy Loi Krathong! 🪷',
  'Thaipusam': 'Happy Thaipusam! 🪔',
  'Day of the Dead': 'Feliz Día de los Muertos! 💀',
  'Boxing Day': 'Happy Boxing Day! 🎁',
  'International Women’s Day': 'Happy Women’s Day! 👩‍🦰',
  'World Environment Day': 'Happy World Environment Day! 🌍',
  'International Yoga Day': 'Happy Yoga Day! 🧘‍♂️',
  'World Music Day': 'Happy Music Day! 🎶',
  'International Workers’ Day': 'Happy Labour Day! 👷‍♀️',
  'World Health Day': 'Happy World Health Day! 🏥',
  'Earth Day': 'Happy Earth Day! 🌎',
  'International Friendship Day': 'Happy Friendship Day! 🤝',
  'World Tourism Day': 'Happy Tourism Day! ✈️',
  'International Literacy Day': 'Happy Literacy Day! 📚',
  'World Food Day': 'Happy World Food Day! 🍽️',
  'International Day of Peace': 'Happy Peace Day! ☮️',
  'World AIDS Day': 'World AIDS Day 🧬',
  'Human Rights Day': 'Human Rights Day ✊',
};

const Income = () => {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const { currency } = useCurrency();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [leaveCount, setLeaveCount] = useState(0);

  const [newIncome, setNewIncome] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    is_holiday: false,
    holiday_reason: '',
    holiday_type: '' as 'leave' | 'festival' | '',
  });

  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '' });

  useEffect(() => {
    fetchIncomes();
    fetchCategories();
  }, []);

  useEffect(() => {
    calculateLeaveCount();
  }, [incomes, selectedMonth]);

  const fetchIncomes = async () => {
    const { data, error } = await supabase
      .from('income')
      .select(`
        *,
        category:income_categories(*)
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching income:', error);
      return;
    }

    setIncomes(data);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('income_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data);
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();

    let holidayMessage = '';
    if (newIncome.is_holiday && newIncome.holiday_type === 'festival') {
      const festival = Object.entries(FESTIVALS).find(([name]) => 
        newIncome.holiday_reason.toLowerCase().includes(name.toLowerCase())
      );
      if (festival) {
        holidayMessage = festival[1];
      }
    }

    const { error } = await supabase
      .from('income')
      .insert([{
        amount: parseFloat(newIncome.amount),
        description: newIncome.description,
        date: newIncome.date,
        category_id: newIncome.category_id,
        is_holiday: newIncome.is_holiday,
        holiday_reason: newIncome.holiday_reason,
        holiday_type: newIncome.holiday_type || null,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }]);

    if (error) {
      console.error('Error adding income:', error);
      return;
    }

    if (holidayMessage) {
      alert(holidayMessage);
    }

    setNewIncome({
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      category_id: '',
      is_holiday: false,
      holiday_reason: '',
      holiday_type: '',
    });
    setIsAddingIncome(false);
    fetchIncomes();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('income_categories')
      .insert([{
        name: newCategory.name,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }]);

    if (error) {
      console.error('Error adding category:', error);
      return;
    }

    setNewCategory({ name: '' });
    setIsAddingCategory(false);
    fetchCategories();
  };

  const handleDeleteIncome = async (id: string) => {
    const { error } = await supabase
      .from('income')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting income:', error);
      return;
    }

    fetchIncomes();
  };

  const calculateMonthlyTotal = () => {
    const currentDate = selectedMonth;
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    return incomes
      .filter(income => {
        const incomeDate = new Date(income.date);
        return incomeDate.getMonth() === month && 
               incomeDate.getFullYear() === year;
      })
      .reduce((total, income) => total + income.amount, 0);
  };

  const calculateLeaveCount = () => {
    const month = selectedMonth.getMonth();
    const year = selectedMonth.getFullYear();
    
    const leaves = incomes.filter(income => {
      const incomeDate = new Date(income.date);
      return incomeDate.getMonth() === month && 
             incomeDate.getFullYear() === year &&
             income.is_holiday &&
             income.holiday_type === 'leave';
    });

    setLeaveCount(leaves.length);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Group incomes by month
    const incomesByMonth = incomes.reduce((acc, income) => {
      const date = new Date(income.date);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      
      acc[monthYear].push({
        Date: income.date,
        Description: income.description,
        Amount: `${currency.symbol}${income.amount.toFixed(2)}`,
        Category: income.category.name,
        'Holiday Type': income.is_holiday ? income.holiday_type : '',
        'Holiday Reason': income.holiday_reason || ''
      });
      
      return acc;
    }, {});

    // Create a sheet for each month
    Object.entries(incomesByMonth).forEach(([monthYear, monthIncomes]) => {
      const worksheet = XLSX.utils.json_to_sheet(monthIncomes);
      
      // Add total row
      const totalAmount = monthIncomes.reduce((sum, inc) => 
        sum + parseFloat(inc.Amount.replace(currency.symbol, '')), 0
      );
      
      XLSX.utils.sheet_add_aoa(worksheet, 
        [[`Total: ${currency.symbol}${totalAmount.toFixed(2)}`]], 
        { origin: -1 }
      );
      
      XLSX.utils.book_append_sheet(workbook, worksheet, monthYear);
    });

    XLSX.writeFile(workbook, 'Income.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Income Report', 20, 20);
    
    let yPos = 40;
    const pageHeight = doc.internal.pageSize.height;
    
    // Group incomes by month
    const incomesByMonth = incomes.reduce((acc, income) => {
      const date = new Date(income.date);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      
      acc[monthYear].push(income);
      return acc;
    }, {});

    Object.entries(incomesByMonth).forEach(([monthYear, monthIncomes]) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.text(monthYear, 20, yPos);
      yPos += 10;

      const totalAmount = monthIncomes.reduce((sum, inc) => sum + inc.amount, 0);

      monthIncomes.forEach((income) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        const text = `${income.date}: ${income.description} (${income.category.name})`;
        doc.text(text, 20, yPos);
        doc.text(`${currency.symbol}${income.amount.toFixed(2)}`, 150, yPos);
        yPos += 7;

        if (income.is_holiday) {
          doc.text(`Holiday: ${income.holiday_type} - ${income.holiday_reason}`, 30, yPos);
          yPos += 7;
        }
      });

      doc.setFontSize(14);
      doc.text(`Total: ${currency.symbol}${totalAmount.toFixed(2)}`, 20, yPos);
      yPos += 20;
    });

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    setShareUrl(pdfUrl);
    doc.save('Income.pdf');
  };

  const shareFile = (type: 'whatsapp' | 'email') => {
    if (type === 'whatsapp') {
      window.open(`https://wa.me/?text=Check out my income report: ${shareUrl}`);
    } else {
      window.location.href = `mailto:?subject=Income Report&body=Check out my income report: ${shareUrl}`;
    }
  };

  const monthlyTotal = calculateMonthlyTotal();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold">Income</h1>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
              variant="outline"
            >
              <Calendar className="w-5 h-5" />
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
              onClick={() => setIsShareModalOpen(true)}
              variant="outline"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
            <Button
              onClick={() => setIsAddingIncome(true)}
              variant="primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Income
            </Button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Monthly Overview</h2>
            <p className="text-3xl font-bold text-yellow">
              {currency.symbol}{monthlyTotal.toFixed(2)}
            </p>
            <p className="text-gray-600">Total income this month</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Leave Summary</h2>
            <p className="text-3xl font-bold text-yellow">{leaveCount}</p>
            <p className="text-gray-600">Days of leave taken this month</p>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Share Report</h2>
            <div className="space-y-4">
              <Button
                onClick={() => shareFile('whatsapp')}
                variant="outline"
                className="w-full"
              >
                Share via WhatsApp
              </Button>
              <Button
                onClick={() => shareFile('email')}
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

      {/* Add Income Modal */}
      {isAddingIncome && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Income</h2>
            <form onSubmit={handleAddIncome} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount ({currency.symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={newIncome.amount}
                  onChange={(e) => setNewIncome({...newIncome, amount: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={newIncome.description}
                  onChange={(e) => setNewIncome({...newIncome, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={newIncome.category_id}
                  onChange={(e) => setNewIncome({...newIncome, category_id: e.target.value})}
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
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={newIncome.date}
                  onChange={(e) => setNewIncome({...newIncome, date: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="is_holiday"
                  checked={newIncome.is_holiday}
                  onChange={(e) => setNewIncome({...newIncome, is_holiday: e.target.checked})}
                  className="h-4 w-4 text-yellow focus:ring-yellow border-gray-300 rounded"
                />
                <label htmlFor="is_holiday" className="ml-2 block text-sm text-gray-900">
                  Mark as holiday
                </label>
              </div>

              {newIncome.is_holiday && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Holiday Type</label>
                    <select
                      value={newIncome.holiday_type}
                      onChange={(e) => setNewIncome({...newIncome, holiday_type: e.target.value as 'leave' | 'festival'})}
                      className="w-full px-3 py-2 border rounded"
                      required
                    >
                      <option value="">Select type</option>
                      <option value="leave">Leave</option>
                      <option value="festival">Festival</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {newIncome.holiday_type === 'leave' ? 'Reason for Leave' : 'Festival Name'}
                    </label>
                    <input
                      type="text"
                      value={newIncome.holiday_reason}
                      onChange={(e) => setNewIncome({...newIncome, holiday_reason: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsAddingIncome(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Income
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Income List */}
      <div className="space-y-4">
        {incomes.map(income => (
          <div key={income.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {currency.symbol}{income.amount.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(income.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-600">{income.description}</p>
                <span className="inline-block bg-gray-100 px-2 py-1 rounded text-sm">
                  {income.category.name}
                </span>
                {income.is_holiday && (
                  <p className="text-sm text-gray-500 mt-2">
                    {income.holiday_type === 'leave' ? '🏖️ Leave' : '🎉 Festival'}: {income.holiday_reason}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDeleteIncome(income.id)}
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

export default Income;