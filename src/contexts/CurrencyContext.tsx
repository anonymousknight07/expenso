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
}

const defaultCurrency: Currency = {
  code: 'USD',
  symbol: '$',
  name: 'US Dollar'
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
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);

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
      availableCurrencies
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};