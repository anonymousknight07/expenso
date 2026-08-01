import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Currency {
  code: string;
  symbol: string;
  name: string;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  availableCurrencies: Currency[];
  calculateEffectiveIncome: (targetMonth?: string) => Promise<number>;
}

const defaultCurrency: Currency = {
  code: 'INR',
  symbol: '₹',
  name: 'Indian Rupee'
};

const availableCurrencies: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const CurrencyContext = createContext<CurrencyContextType>({
  currency: defaultCurrency,
  setCurrency: () => {},
  availableCurrencies: availableCurrencies,
  calculateEffectiveIncome: async () => 0,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);

  const calculateDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const calculateDailyPay = (inHandAmount: number, date: Date) => {
    const daysInMonth = calculateDaysInMonth(date);
    return inHandAmount / daysInMonth;
  };

  const calculateEffectiveIncome = async (targetMonth?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    let query = supabase.from('income').select('*').eq('user_id', user.id);

    if (targetMonth && targetMonth !== 'all') {
      const [yearStr, monthStr] = targetMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, month, 0).getDate();

      const startDateStr = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
      const endDateStr = `${yearStr}-${monthStr.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`;

      query = query.gte('date', startDateStr).lte('date', endDateStr);
    } else if (!targetMonth) {
      const currentDate = new Date();
      const yearStr = currentDate.getFullYear().toString();
      const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

      const startDateStr = `${yearStr}-${monthStr}-01`;
      const endDateStr = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`;

      query = query.gte('date', startDateStr).lte('date', endDateStr);
    }

    const { data: incomes, error } = await query;

    if (error || !incomes) return 0;

    let totalIncome = 0;
    const leaves = incomes.filter(income =>
      income.is_holiday &&
      income.holiday_type === 'leave' &&
      !isWeekend(new Date(income.date))
    );

    incomes.forEach(income => {
      if (!income.is_holiday) {
        const amt = Number(income.in_hand_amount) || Number(income.amount) || 0;
        totalIncome += amt;
      }
    });

    if (leaves.length > 0 && totalIncome > 0) {
      const dateForDays = targetMonth && targetMonth !== 'all'
        ? new Date(targetMonth + "-01")
        : new Date();
      const daysInMonth = calculateDaysInMonth(dateForDays);
      const dailyPay = totalIncome / daysInMonth;
      const leaveDeduction = leaves.length * dailyPay;
      totalIncome = Math.max(0, totalIncome - leaveDeduction);
    }

    return totalIncome;
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  useEffect(() => {
    const loadUserCurrency = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('currency_code')
          .eq('user_id', user.id)
          .single();

        if (data?.currency_code) {
          const userCurrency = availableCurrencies.find(c => c.code === data.currency_code);
          if (userCurrency) {
            setCurrency(userCurrency);
          }
        }
      }
    };

    loadUserCurrency();
  }, []);

  const updateCurrency = async (newCurrency: Currency) => {
    setCurrency(newCurrency);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          currency_code: newCurrency.code
        });
    }
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency: updateCurrency,
      availableCurrencies,
      calculateEffectiveIncome
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};