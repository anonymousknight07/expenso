import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

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
          <div className="flex items-center">
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