import { ArrowRight } from 'lucide-react';
import Button from '../components/common/Button';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-full md:w-1/2">
            <img 
              src="./hero.png" 
              alt="Diverse people illustration" 
              className="w-full h-auto rounded-lg shadow-lg" 
            />
          </div>
          <div className="w-full md:w-1/2 flex flex-col gap-6">
            <div className="relative">
              <h1 className="text-4xl md:text-7xl font-serif text-black leading-tight">
               All spent<span className="text-yellow">!</span><br />
               No Saving<span className="text-yellow">!</span>
              </h1>
              <p className="text-gray-600 text-lg md:text-xl">
                use
              </p>
              <h1 className="text-5xl md:text-9xl font-serif text-black leading-tight">
               EXPENSO<span className="text-yellow">!</span></h1>
              <div className="h-1 w-full bg-black mt-4"></div>
            </div>
            <p className="text-gray-600 text-lg md:text-xl">
              Take control of your finances with our intuitive expense tracking app. 
              Monitor your spending, set budgets, and achieve your financial goals.
            </p>
            <div className="mt-4">
              <Button onClick={handleGetStarted} variant="primary" className="inline-flex items-center">
                GET STARTED
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Features Section */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-gray-50 rounded-lg hover:bg-[#e6b800] transition-colors duration-300">
                <h3 className="text-xl font-serif mb-3">Expense Tracking</h3>
                <p className="text-gray-600">Monitor all your expenses in one place with detailed categorization and insights.</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg hover:bg-[#e6b800] transition-colors duration-300">
                <h3 className="text-xl font-serif mb-3">Budget Planning</h3>
                <p className="text-gray-600">Set and track budgets by category with visual progress indicators.</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg hover:bg-[#e6b800] transition-colors duration-300">
                <h3 className="text-xl font-serif mb-3">Income Management</h3>
                <p className="text-gray-600">Track multiple income sources and analyze your earning patterns.</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg hover:bg-[#e6b800] transition-colors duration-300">
                <h3 className="text-xl font-serif mb-3">Smart Analytics</h3>
                <p className="text-gray-600">Get detailed reports and insights about your spending habits.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;