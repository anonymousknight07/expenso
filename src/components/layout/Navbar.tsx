import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../contexts/CurrencyContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currency, setCurrency, availableCurrencies } = useCurrency();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const getNavItems = () => {
    if (user) {
      return [
        { name: 'DASHBOARD', path: '/dashboard' },
        { name: 'EXPENSES', path: '/expenses' },
        { name: 'INCOME', path: '/income' },
        { name: 'BUDGET', path: '/budget' },
        { name: 'REPORTS', path: '/reports' },
      ];
    }
    return [
      { name: 'HOME', path: '/' },
    ];
  };

  const navItems = getNavItems();

  return (
    <header className="bg-yellow border-b-2 border-black">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Link to="/" className="flex items-center">
              <span className="font-serif text-xl text-black">
                EX<span className="text-black">PENSO</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`text-sm font-medium transition-colors relative ${
                  location.pathname === item.path 
                    ? 'text-black after:content-[""] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-black' 
                    : 'text-black hover:text-gray-600'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)}
                  className="text-sm font-medium text-black hover:text-gray-600 transition-colors px-3 py-2 rounded-md border border-black"
                >
                  {currency.code} ({currency.symbol})
                </button>
                {isCurrencyMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    {availableCurrencies.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => {
                          setCurrency(curr);
                          setIsCurrencyMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {curr.name} ({curr.symbol})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {user ? (
              <button
                onClick={handleSignOut}
                className="text-sm font-medium bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
              >
                SIGN OUT
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
                >
                  LOGIN
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
                >
                  SIGN UP
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="text-black hover:text-gray-600 focus:outline-none"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 pb-6">
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.path 
                      ? 'text-black font-bold' 
                      : 'text-black hover:text-gray-600'
                  }`}
                  onClick={toggleMenu}
                >
                  {item.name}
                </Link>
              ))}
              {user && (
                <div className="py-2 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-2">Select Currency</p>
                  <select
                    value={currency.code}
                    onChange={(e) => {
                      const newCurrency = availableCurrencies.find(c => c.code === e.target.value);
                      if (newCurrency) setCurrency(newCurrency);
                    }}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    {availableCurrencies.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.name} ({curr.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200">
                {user ? (
                  <button
                    onClick={() => {
                      handleSignOut();
                      toggleMenu();
                    }}
                    className="text-sm font-medium bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors w-fit"
                  >
                    SIGN OUT
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
                      onClick={toggleMenu}
                    >
                      LOGIN
                    </Link>
                    <Link
                      to="/register"
                      className="text-sm font-medium bg-black text-white px-4 py-2 rounded inline-block w-fit hover:bg-gray-800 transition-colors"
                      onClick={toggleMenu}
                    >
                      SIGN UP
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;