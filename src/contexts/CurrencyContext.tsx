import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getPayCycleRange, PayCycleRange, PayCycleType } from '../utils/dateUtils';

interface Currency {
  code: string;
  symbol: string;
  name: string;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  availableCurrencies: Currency[];
  payCycleType: PayCycleType;
  salaryDay: number;
  setPayCycleType: (type: PayCycleType) => void;
  setSalaryDay: (day: number) => void;
  getPayCycleRange: (targetMonth?: string | Date | null) => PayCycleRange;
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
  payCycleType: 'calendar',
  salaryDay: 28,
  setPayCycleType: () => {},
  setSalaryDay: () => {},
  getPayCycleRange: (targetMonth?: string | Date | null) => getPayCycleRange(targetMonth, 'calendar', 28),
  calculateEffectiveIncome: async () => 0,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);
  const [payCycleType, setPayCycleTypeState] = useState<PayCycleType>(() => {
    const saved = localStorage.getItem('expenso_pay_cycle_type');
    return saved === 'salary' ? 'salary' : 'calendar';
  });
  const [salaryDay, setSalaryDayState] = useState<number>(() => {
    const saved = localStorage.getItem('expenso_salary_day');
    return saved ? parseInt(saved, 10) : 28;
  });

  const getPayCycleRangeBound = useCallback(
    (targetMonth?: string | Date | null) => {
      return getPayCycleRange(targetMonth, payCycleType, salaryDay);
    },
    [payCycleType, salaryDay]
  );

  const calculateDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const calculateEffectiveIncome = async (targetMonth?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    let query = supabase.from('income').select('*').eq('user_id', user.id);

    if (targetMonth !== 'all') {
      const range = getPayCycleRange(targetMonth, payCycleType, salaryDay);
      query = query.gte('date', range.startDateStr).lte('date', range.endDateStr);
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
      const range = getPayCycleRange(targetMonth, payCycleType, salaryDay);
      const daysInMonth = calculateDaysInMonth(range.startDate);
      const dailyPay = totalIncome / (daysInMonth || 30);
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
    const loadUserPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const { data } = await supabase
            .from('user_preferences')
            .select('currency_code')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data?.currency_code) {
            const userCurrency = availableCurrencies.find(c => c.code === data.currency_code);
            if (userCurrency) setCurrencyState(userCurrency);
          }
        } catch (err) {
          console.warn('Failed to load user currency from database:', err);
        }
      }
    };

    loadUserPreferences();
  }, []);

  const updateCurrency = async (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            currency_code: newCurrency.code
          });
      } catch (e) {
        console.warn('Could not save currency preference:', e);
      }
    }
  };

  const updatePayCycleType = (type: PayCycleType) => {
    setPayCycleTypeState(type);
    localStorage.setItem('expenso_pay_cycle_type', type);
  };

  const updateSalaryDay = (day: number) => {
    const validDay = Math.min(31, Math.max(1, day));
    setSalaryDayState(validDay);
    localStorage.setItem('expenso_salary_day', String(validDay));
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency: updateCurrency,
      availableCurrencies,
      payCycleType,
      salaryDay,
      setPayCycleType: updatePayCycleType,
      setSalaryDay: updateSalaryDay,
      getPayCycleRange: getPayCycleRangeBound,
      calculateEffectiveIncome
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};