import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, Tag, Trash2, FileSpreadsheet, File as FilePdf, Share2 } from 'lucide-react';
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
  in_hand_amount?: number;
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
  'Yom Kippur': 'G❜mar Chatimah Tovah! ✡️',
  'Ramadan': 'Ramadan Kareem! 🌙',
  'Lunar New Year': 'Happy Lunar New Year! 🧧',
  'Mid-Autumn Festival': 'Happy Mid-Autumn Festival! 🌕',
  'Pongal': 'Happy Pongal! 🌾',
  'Vaisakhi': 'Happy Vaisakhi! 🏵️',
  'Bastille Day': 'Bonne Fête Nationale! 🇫🇷',
  'St. Patrick❜s Day': 'Happy St. Patrick❜s Day! ☘️',
  'Mardi Gras': 'Happy Mardi Gras! 🎭',
  'La Tomatina': 'Enjoy La Tomatina! 🍅',
  'Gion Matsuri': 'Happy Gion Matsuri! 🎐',
  'Obon': 'Happy Obon! 🏮',
  'Chuseok': 'Happy Chuseok! 🌕',
  'Loi Krathong': 'Happy Loi Krathong! 🪷',
  'Thaipusam': 'Happy Thaipusam! 🪔',
  'Day of the Dead': 'Feliz Día de los Muertos! 💀',
  'Boxing Day': 'Happy Boxing Day! 🎁',
  'International Women❜s Day': 'Happy Women❜s Day! 👩‍🦰',
  'World Environment Day': 'Happy World Environment Day! 🌍',
  'International Yoga Day': 'Happy Yoga Day! 🧘‍♂️',
  'World Music Day': 'Happy Music Day! 🎶',
  'International Workers❜ Day': 'Happy Labour Day! 👷‍♀️',
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
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  const [newIncome, setNewIncome] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    in_hand_amount: '',
  });

  const [newHoliday, setNewHoliday] = useState({
    date: new Date().toISOString().split('T')[0],
    holiday_type: '' as 'leave' | 'festival' | '',
    holiday_reason: '',
  });

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

  const calculateDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const calculateDailyPay = (inHandAmount: number) => {
    const daysInMonth = calculateDaysInMonth(selectedMonth);
    return inHandAmount / daysInMonth;
  };

  // Modified function to calculate salary after leaves
  const calculateSalaryAfterLeaves = () => {
    const currentMonthIncomes = incomes.filter(income => {
      const incomeDate = new Date(income.date);
      return (
        incomeDate.getMonth() === selectedMonth.getMonth() &&
        incomeDate.getFullYear() === selectedMonth.getFullYear()
      );
    });

    // Calculate total regular income for the month (not including holidays)
    const regularIncomes = currentMonthIncomes.filter(income => !income.is_holiday);
    const totalIncome = regularIncomes.reduce((sum, income) => sum + (income.in_hand_amount || income.amount), 0);
    
    // Calculate daily pay based on the first valid income entry
    let dailyPayRate = 0;
    for (const income of regularIncomes) {
      if (income.in_hand_amount) {
        dailyPayRate = calculateDailyPay(income.in_hand_amount);
        break;
      }
    }
    
    // Count leave days
    const leaveEntries = currentMonthIncomes.filter(
      income => income.is_holiday && income.holiday_type === 'leave'
    );
    const leaveCount = leaveEntries.length;
    
    // Calculate total deduction for leaves
    const leaveDeduction = leaveCount * dailyPayRate;
    
    // Return total income minus leave deductions
    return totalIncome - leaveDeduction;
  };

  const calculateTotalIncome = () => {
    return incomes.reduce((total, income) => {
      // Only count non-holiday entries for total income
      if (!income.is_holiday) {
        return total + (income.in_hand_amount || income.amount);
      }
      return total;
    }, 0);
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('income')
      .insert([{
        amount: parseFloat(newIncome.amount),
        description: newIncome.description,
        date: newIncome.date,
        category_id: newIncome.category_id,
        in_hand_amount: parseFloat(newIncome.in_hand_amount),
        is_holiday: false,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }]);

    if (error) {
      console.error('Error adding income:', error);
      return;
    }

    setNewIncome({
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      category_id: '',
      in_hand_amount: '',
    });
    setIsAddingIncome(false);
    fetchIncomes();
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();

    let holidayMessage = '';
    if (newHoliday.holiday_type === 'festival') {
      const festival = Object.entries(FESTIVALS).find(([name]) => 
        newHoliday.holiday_reason.toLowerCase().includes(name.toLowerCase())
      );
      if (festival) {
        holidayMessage = festival[1];
      }
    }

    const { error } = await supabase
      .from('income')
      .insert([{
        date: newHoliday.date,
        is_holiday: true,
        holiday_type: newHoliday.holiday_type,
        holiday_reason: newHoliday.holiday_reason,
        amount: 0,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }]);

    if (error) {
      console.error('Error adding holiday:', error);
      return;
    }

    if (holidayMessage) {
      alert(holidayMessage);
    }

    setNewHoliday({
      date: new Date().toISOString().split('T')[0],
      holiday_type: '',
      holiday_reason: '',
    });
    setIsAddingHoliday(false);
    fetchIncomes();
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
        'In-Hand Amount': income.in_hand_amount ? `${currency.symbol}${income.in_hand_amount.toFixed(2)}` : '-',
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

      const totalAmount = monthIncomes.reduce((sum, inc) => sum + (inc.in_hand_amount || inc.amount), 0);

      monthIncomes.forEach((income) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        const text = `${income.date}: ${income.description} (${income.category.name})`;
        doc.text(text, 20, yPos);
        doc.text(`${currency.symbol}${(income.in_hand_amount || income.amount).toFixed(2)}`, 150, yPos);
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

  // Calculate daily pay for display
  const getDailyPayForDisplay = () => {
    // Find a regular income entry to calculate daily pay from
    const regularIncomes = incomes.filter(income => !income.is_holiday && income.in_hand_amount);
    if (regularIncomes.length === 0) return 0;
    
    // Use the first valid income entry to calculate daily pay
    const income = regularIncomes[0];
    return calculateDailyPay(income.in_hand_amount || income.amount);
  };

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
            <Button
              onClick={() => setIsAddingHoliday(true)}
              variant="outline"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Holiday
            </Button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Total Income</h2>
            <p className="text-3xl font-bold text-green-500">
              {currency.symbol}{calculateTotalIncome().toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Daily Pay</h2>
            <p className="text-3xl font-bold text-yellow-500">
              {currency.symbol}{getDailyPayForDisplay().toFixed(2)}
            </p>
            <p className="text-gray-600">Per day earnings</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Salary After Leaves</h2>
            <p className="text-3xl font-bold text-blue-500">
              {currency.symbol}{calculateSalaryAfterLeaves().toFixed(2)}
            </p>
            <p className="text-gray-600">{leaveCount} leave(s) taken ({currency.symbol}{(getDailyPayForDisplay() * leaveCount).toFixed(2)} deducted)</p>
          </div>
        </div>
      </div>

      {/* Add Income Modal */}
      {isAddingIncome && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Income</h2>
            <form onSubmit={handleAddIncome} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">In-Hand Amount ({currency.symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={newIncome.in_hand_amount}
                  onChange={(e) => setNewIncome({...newIncome, in_hand_amount: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Daily pay will be: {currency.symbol}
                  {newIncome.in_hand_amount 
                    ? (parseFloat(newIncome.in_hand_amount) / calculateDaysInMonth(selectedMonth)).toFixed(2)
                    : '0.00'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Gross Amount ({currency.symbol})</label>
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

      {/* Add Holiday Modal */}
      {isAddingHoliday && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Holiday</h2>
            <form onSubmit={handleAddHoliday} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Holiday Type</label>
                <select
                  value={newHoliday.holiday_type}
                  onChange={(e) => setNewHoliday({...newHoliday, holiday_type: e.target.value as 'leave' | 'festival'})}
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
                  {newHoliday.holiday_type === 'leave' ? 'Reason for Leave' : 'Festival Name'}
                </label>
                <input
                  type="text"
                  value={newHoliday.holiday_reason}
                  onChange={(e) => setNewHoliday({...newHoliday, holiday_reason: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsAddingHoliday(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Holiday
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Income List/Calendar View */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {incomes.map(income => (
            <div key={income.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {!income.is_holiday && (
                      <span className="text-lg font-semibold">
                        {currency.symbol}{(income.in_hand_amount || income.amount).toFixed(2)}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {new Date(income.date).toLocaleDateString()}
                    </span>
                  </div>
                  {!income.is_holiday && (
                    <>
                      <p className="text-gray-600">{income.description}</p>
                      <span className="inline-block bg-gray-100 px-2 py-1 rounded text-sm">
                        {income.category?.name}
                      </span>
                    </>
                  )}
                  {income.is_holiday && (
                    <p className="text-sm text-gray-500 mt-2">
                      {income.holiday_type === 'leave' ? '🏖️ Leave' : '🎉 Festival'}: {income.holiday_reason}
                      {income.holiday_type === 'leave' && (
                        <span className="text-red-500 ml-2">
                          (Deduction: {currency.symbol}{getDailyPayForDisplay().toFixed(2)})
                        </span>
                      )}
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
      ) : (
        <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => {
                const newDate = new Date(selectedMonth);
                newDate.setMonth(newDate.getMonth() - 1);
                setSelectedMonth(newDate);
              }}
              className="p-2 hover:bg-gray-100 rounded"
            >
              Previous Month
            </button>
            <h2 className="text-xl font-semibold">
              {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => {
                const newDate = new Date(selectedMonth);
                newDate.setMonth(newDate.getMonth() + 1);
                setSelectedMonth(newDate);
              }}
              className="p-2 hover:bg-gray-100 rounded"
            >
              Next Month
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-medium p-2">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }, (_, i) => {
              const date = new Date(selectedMonth);
              date.setDate(1);
              const firstDay = date.getDay();
              date.setDate(i - firstDay + 1);
              const dateStr = date.toISOString().split('T')[0];
              const dayIncomes = incomes.filter(income => income.date === dateStr);
              const isHoliday = dayIncomes.some(income => income.is_holiday);
              const totalAmount = dayIncomes.reduce((sum, income) => 
                sum + (income.is_holiday ? 0 : (income.in_hand_amount || income.amount)), 0
              );

              return (
                <div
                  key={i}
                  onClick={() => {
                    const newDate = new Date(date);
                    const today = new Date();
                    if (newDate.getMonth() === selectedMonth.getMonth()) {
                      setNewIncome(prev => ({ ...prev, date: dateStr }));
                      setIsAddingIncome(true);
                    }
                  }}
                  className={`
                    p-2 border rounded min-h-[100px] cursor-pointer
                    ${date.getMonth() === selectedMonth.getMonth() ? 'bg-white' : 'bg-gray-50'}
                    ${isHoliday ? 'border-red-200' : ''}
                    hover:bg-gray-50 transition-colors
                  `}
                >
                  <div className="text-right text-sm text-gray-600">
                    {date.getDate()}
                  </div>
                  {dayIncomes.length > 0 && (
                    <div className="mt-2">
                      {totalAmount > 0 && (
                        <div className="text-sm font-medium">
                          {currency.symbol}{totalAmount.toFixed(2)}
                        </div>
                      )}
                      {dayIncomes.map(income => (
                        <div key={income.id} className="text-xs text-gray-500">
                          {income.is_holiday ? (
                            <span className={income.holiday_type === 'leave' ? 'text-red-500' : 'text-green-500'}>
                              {income.holiday_reason}
                            </span>
                          ) : (
                            income.description
                          )}
                        </div>
                      ))}
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

export default Income;