import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCurrency } from "../../contexts/CurrencyContext";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currency, setCurrency, availableCurrencies } = useCurrency();

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Close mobile menu when switching to desktop
      if (window.innerWidth >= 768) {
        setIsMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsMenuOpen(false);
    navigate("/");
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const getNavItems = () => {
    if (user) {
      return [
        { name: "DASHBOARD", path: "/dashboard" },
        { name: "EXPENSES", path: "/expenses" },
        { name: "INCOME", path: "/income" },
        { name: "BUDGET", path: "/budget" },
        { name: "JAR SYSTEM", path: "/jar-system" },
        { name: "STOCK MARKET", path: "/stock-market" },
        { name: "REPORTS", path: "/reports" },
      ];
    }
    return [{ name: "HOME", path: "/" }];
  };

  const navItems = getNavItems();

  return (
    <header className="bg-yellow border-b-2 border-black sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Link to="/" className="flex items-center" onClick={closeMenu}>
              <span className="font-serif text-lg sm:text-xl text-black">
                EX<span className="text-black">PENSO</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-4 xl:space-x-8 flex-1 justify-center">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`text-xs xl:text-sm font-medium transition-colors relative whitespace-nowrap px-2 py-1 ${
                  location.pathname === item.path
                    ? 'text-black after:content-[""] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-black'
                    : "text-black hover:text-gray-600"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)}
                  className="text-xs lg:text-sm font-medium text-black hover:text-gray-600 transition-colors px-2 lg:px-3 py-2 rounded-md border border-black flex items-center gap-1 whitespace-nowrap"
                >
                  <span className="hidden lg:inline">{currency.code}</span>
                  <span className="lg:hidden">{currency.symbol}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {isCurrencyMenuOpen && (
                  <div className="absolute right-0 mt-2 w-40 lg:w-48 bg-white rounded-md shadow-lg py-1 z-50 max-h-60 overflow-y-auto">
                    {availableCurrencies.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => {
                          setCurrency(curr);
                          setIsCurrencyMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs lg:text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-medium">{curr.code}</span>
                        <span className="text-gray-500 ml-2">
                          ({curr.symbol})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {user ? (
              <button
                onClick={handleSignOut}
                className="text-xs lg:text-sm font-medium bg-black text-white px-3 lg:px-4 py-2 rounded hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                SIGN OUT
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="text-xs lg:text-sm font-medium text-black hover:text-gray-600 transition-colors px-2"
                >
                  LOGIN
                </Link>
                <Link
                  to="/register"
                  className="text-xs lg:text-sm font-medium bg-black text-white px-3 lg:px-4 py-2 rounded hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  SIGN UP
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="text-black hover:text-gray-600 focus:outline-none p-2"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden transition-all duration-300 ease-in-out ${
            isMenuOpen
              ? "max-h-screen opacity-100"
              : "max-h-0 opacity-0 overflow-hidden"
          }`}
        >
          <div className="py-4 pb-6 space-y-4">
            {/* Navigation Links */}
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`text-sm font-medium transition-colors py-2 px-1 ${
                    location.pathname === item.path
                      ? "text-black font-bold border-l-4 border-black pl-3"
                      : "text-black hover:text-gray-600"
                  }`}
                  onClick={closeMenu}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Currency Selector for Mobile */}
            {user && (
              <div className="py-3 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-3">
                  Select Currency
                </p>
                <select
                  value={currency.code}
                  onChange={(e) => {
                    const newCurrency = availableCurrencies.find(
                      (c) => c.code === e.target.value
                    );
                    if (newCurrency) setCurrency(newCurrency);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  {availableCurrencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.name} ({curr.symbol})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auth Actions for Mobile */}
            <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium bg-black text-white px-4 py-3 rounded hover:bg-gray-800 transition-colors text-center"
                >
                  SIGN OUT
                </button>
              ) : (
                <div className="flex flex-col space-y-3">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-black hover:text-gray-600 transition-colors py-2 text-center"
                    onClick={closeMenu}
                  >
                    LOGIN
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-medium bg-black text-white px-4 py-3 rounded hover:bg-gray-800 transition-colors text-center"
                    onClick={closeMenu}
                  >
                    SIGN UP
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-30 md:hidden"
          onClick={closeMenu}
        />
      )}
    </header>
  );
};

export default Navbar;
