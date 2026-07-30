import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useCurrency } from "../../contexts/CurrencyContext";

interface NavItem {
  name: string;
  path: string;
}

const PRIMARY_ITEMS: NavItem[] = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Expenses", path: "/expenses" },
  { name: "Income", path: "/income" },
  { name: "Budget", path: "/budget" },
  { name: "Reports", path: "/reports" },
];

const MORE_ITEMS: NavItem[] = [
  { name: "Achievements", path: "/achievements" },
  { name: "Expenso Shop", path: "/shop" },
  { name: "No-Spend Streaks", path: "/no-spend" },
  { name: "Time Machine", path: "/time-machine" },
  { name: "UPI Sync", path: "/upi-sync" },
  // { name: "Jar System", path: "/jar-system" },
  { name: "Market News", path: "/market" },
  // { name: "Social", path: "/social" },
  { name: "Receipt Scan", path: "/receipt-scanner" },
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currency, setCurrency, availableCurrencies } = useCurrency();
  const currencyRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking anywhere else
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setIsCurrencyMenuOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsMoreMenuOpen(false);
  }, [location.pathname]);

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

  const isActive = (path: string) => location.pathname === path;
  const moreIsActive = MORE_ITEMS.some((item) => isActive(item.path));

  const linkClasses = (path: string) =>
    `text-sm font-medium rounded-full px-3 py-1.5 transition-all whitespace-nowrap ${
      isActive(path)
        ? "bg-gradient-to-br from-[#ff3c02] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30"
        : "text-slate-200 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <>
      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0b]/70 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16 gap-3">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0" onClick={() => setIsMenuOpen(false)}>
              <img src="/logo-full.png" alt="Expenso" className="h-8 w-auto" />
            </Link>

            {/* Desktop Navigation */}
            {user && (
              <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
                {PRIMARY_ITEMS.map((item) => (
                  <Link key={item.name} to={item.path} className={linkClasses(item.path)}>
                    {item.name}
                  </Link>
                ))}

                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className={`text-sm font-medium rounded-full px-3 py-1.5 transition-all flex items-center gap-1 ${
                      moreIsActive
                        ? "bg-gradient-to-br from-[#ff3c02] to-[#fa7041] text-white shadow-md shadow-[#ff3c02]/30"
                        : "text-slate-200 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    More
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${isMoreMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isMoreMenuOpen && (
                    <div className="absolute left-0 mt-2 w-48 glass-modal py-2 z-50">
                      {MORE_ITEMS.map((item) => (
                        <Link
                          key={item.name}
                          to={item.path}
                          onClick={() => setIsMoreMenuOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            isActive(item.path)
                              ? "text-white font-semibold bg-white/10"
                              : "text-slate-200 hover:bg-white/10"
                          }`}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            )}

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
              {user && (
                <div className="relative" ref={currencyRef}>
                  <button
                    onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)}
                    className="text-sm font-medium text-slate-200 hover:text-white transition-colors px-3 py-1.5 rounded-full glass-chip flex items-center gap-1"
                  >
                    {currency.code}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {isCurrencyMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 glass-modal py-1 z-50 max-h-60 overflow-y-auto">
                      {availableCurrencies.map((curr) => (
                        <button
                          key={curr.code}
                          onClick={() => {
                            setCurrency(curr);
                            setIsCurrencyMenuOpen(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors"
                        >
                          <span className="font-medium">{curr.code}</span>
                          <span className="text-slate-400 ml-2">({curr.symbol})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="text-sm font-semibold bg-white/10 text-white px-4 py-2 rounded-full hover:bg-white/15 transition-colors shadow-md"
                >
                  Sign out
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-slate-200 hover:text-white transition-colors px-3 py-2"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-semibold bg-gradient-to-br from-yellow to-amber-400 text-white px-4 py-2 rounded-full shadow-md shadow-amber-400/40 hover:brightness-105 transition-all"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-100 hover:text-white focus:outline-none p-2 rounded-xl glass-chip"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div
            className={`lg:hidden transition-all duration-300 ease-in-out relative z-40 ${
              isMenuOpen ? "max-h-screen opacity-100 pb-6" : "max-h-0 opacity-0 overflow-hidden"
            }`}
          >
            <div className="pt-2 space-y-4">
              <div className="flex flex-col gap-1">
                {(user ? [...PRIMARY_ITEMS, ...MORE_ITEMS] : [{ name: "Home", path: "/" }]).map(
                  (item) => (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={`text-sm font-medium transition-colors py-2.5 px-4 rounded-xl ${
                        isActive(item.path)
                          ? "bg-white/10 text-white shadow-md"
                          : "text-slate-200 hover:bg-white/10"
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  )
                )}
              </div>

              {user && (
                <div className="pt-3 border-t border-white/60">
                  <p className="text-sm font-medium text-slate-300 mb-2 px-1">Currency</p>
                  <select
                    value={currency.code}
                    onChange={(e) => {
                      const newCurrency = availableCurrencies.find(
                        (c) => c.code === e.target.value
                      );
                      if (newCurrency) setCurrency(newCurrency);
                    }}
                    className="w-full px-3 py-2 text-sm"
                  >
                    {availableCurrencies.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.name} ({curr.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-3 border-t border-white/60">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="text-sm font-semibold bg-white/10 text-white px-4 py-3 rounded-xl hover:bg-white/15 transition-colors text-center shadow-md"
                  >
                    Sign out
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="text-sm font-medium text-slate-200 hover:text-white transition-colors py-2 text-center"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="text-sm font-semibold bg-gradient-to-br from-yellow to-amber-400 text-white px-4 py-3 rounded-xl text-center shadow-md shadow-amber-400/40"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
