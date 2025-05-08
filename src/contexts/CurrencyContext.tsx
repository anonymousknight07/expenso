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
  calculateEffectiveIncome: () => Promise<number>;
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

  const calculateEffectiveIncome = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data: incomes } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startOfMonth.toISOString())
      .lte('date', endOfMonth.toISOString());

    if (!incomes) return 0;

    let totalIncome = 0;
    const leaves = incomes.filter(income => 
      income.is_holiday && 
      income.holiday_type === 'leave' &&
      !isWeekend(new Date(income.date))
    );

    incomes.forEach(income => {
      if (!income.is_holiday && income.in_hand_amount) {
        const dailyPay = calculateDailyPay(income.in_hand_amount, new Date(income.date));
        const leaveDeduction = leaves.length * dailyPay;
        totalIncome += income.in_hand_amount - leaveDeduction;
      }
    });

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