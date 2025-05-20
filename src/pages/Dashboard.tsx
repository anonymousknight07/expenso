import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../contexts/CurrencyContext';
import { Camera, Trophy, Star, Brain, Heart, ThumbsUp, Target, Plus, Share2, Crown, Trash2, X } from 'lucide-react';
import Button from '../components/common/Button';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  health_score: number;
  bio: string;
  occupation: string;
  last_active: string;
}

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  completed: boolean;
}

interface WishlistItem {
  id: string;
  title: string;
  price: number;
  added_date: string;
  reflection: string | null;
  can_buy_date: string;
  reviewed: boolean;
}

interface Achievement {
  id: string;
  badge_id: string;
  unlocked_at: string;
  shared: boolean;
}

const Dashboard = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [dailyExpenses, setDailyExpenses] = useState<any[]>([]);
  const [categoryExpenses, setCategoryExpenses] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showAddWishlistModal, setShowAddWishlistModal] = useState(false);
 
  const [showBadgeNotification, setShowBadgeNotification] = useState(false);
  const [newBadge, setNewBadge] = useState<string>('');
  const [newGoal, setNewGoal] = useState({
    title: '',
    target_amount: '',
    deadline: '',
  });
  const [newWishlistItem, setNewWishlistItem] = useState({
    title: '',
    price: '',
    reflection: '',
  });
  const { currency } = useCurrency();
  const navigate = useNavigate();

  const badges = [
    { id: 'first_transaction', icon: Star, title: 'First Transaction', description: 'Made your first transaction' },
    { id: 'budget_master', icon: Brain, title: 'Budget Master', description: 'Set up your first budget' },
    { id: 'savings_champion', icon: Heart, title: 'Savings Champion', description: 'Reached savings goal' },
    { id: 'perfect_month', icon: ThumbsUp, title: 'Perfect Month', description: 'Stayed within budget for a month' },
    { id: 'goal_setter', icon: Target, title: 'Goal Setter', description: 'Created your first financial goal' },
  ];

useEffect(() => {
  fetchProfile();
  fetchFinancialData();
  fetchGoals();
  fetchWishlist();
  fetchAchievements();
  checkNewAchievements();
  
  trackUserActivity('dashboard_visit');
}, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    if (data) {
      setProfile(data);
    }
  };

  const fetchFinancialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

    // Fetch income
    const { data: incomeData } = await supabase
      .from('income')
      .select('amount, in_hand_amount')
      .eq('user_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    const monthlyIncome = (incomeData || []).reduce((sum, income) => 
      sum + (income.in_hand_amount || income.amount), 0
    );
    setTotalIncome(monthlyIncome);

    // Fetch expenses with categories
    const { data: expensesData } = await supabase
      .from('expenses')
      .select(`
        amount,
        date,
        expense_category_mappings!inner (
          expense_categories (
            name,
            color
          )
        )
      `)
      .eq('user_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (expensesData) {
      const totalExp = expensesData.reduce((sum, exp) => sum + exp.amount, 0);
      setTotalExpenses(totalExp);

      // Process daily expenses
      const dailyExp = expensesData.reduce((acc, exp) => {
        const date = new Date(exp.date).toLocaleDateString();
        acc[date] = (acc[date] || 0) + exp.amount;
        return acc;
      }, {});
      setDailyExpenses(Object.entries(dailyExp).map(([date, amount]) => ({ date, amount })));

      // Process category expenses
      const categoryExp = expensesData.reduce((acc, exp) => {
        const category = exp.expense_category_mappings[0].expense_categories.name;
        acc[category] = (acc[category] || 0) + exp.amount;
        return acc;
      }, {});
      setCategoryExpenses(Object.entries(categoryExp).map(([category, amount]) => ({ category, amount })));
    }
  };

  const fetchGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching goals:', error);
      return;
    }

    setGoals(data || []);
  };

  const fetchWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching wishlist:', error);
      return;
    }

    setWishlistItems(data || []);
  };

  const fetchAchievements = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching achievements:', error);
      return;
    }

    setAchievements(data || []);
  };

  const updateXPAndLevel = async (xpToAdd) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch current profile
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('xp, level')
      .eq('id', user.id)
      .single();

    if (!currentProfile) return;

    // Calculate new XP and level
    const newXP = currentProfile.xp + xpToAdd;
    const newLevel = Math.floor(newXP / 100) + 1; // Level up every 100 XP
    
    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update({ 
        xp: newXP,
        level: newLevel
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating XP and level:', error);
      return;
    }

    // Update local state
    setProfile(prev => ({
      ...prev,
      xp: newXP,
      level: newLevel
    }));
  };

  const trackUserActivity = async (activityType) => {
    const xpRewards = {
      'login': 5,
      'achievement': 20,
      'goal_created': 10,
      'goal_completed': 30,
      'wishlist_added': 5,
      'budget_planned': 15,
      'dashboard_visit': 2
    };

    const xpToAdd = xpRewards[activityType] || 0;
    if (xpToAdd > 0) {
      await updateXPAndLevel(xpToAdd);
    }
  };

  const checkNewAchievements = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newAchievements, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', user.id)
      .eq('notified', false)
      .maybeSingle();

    if (error) {
      console.error('Error fetching achievements:', error);
      return;
    }

    if (newAchievements) {
      const badge = badges.find(b => b.id === newAchievements.badge_id);
      if (badge) {
        setNewBadge(badge.title);
        setShowBadgeNotification(true);

        await supabase
          .from('achievements')
          .update({ notified: true })
          .eq('id', newAchievements.id);
          
        // Award XP for achievement
        trackUserActivity('achievement');
      }
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('goals')
      .insert([{
        user_id: user.id,
        title: newGoal.title,
        target_amount: parseFloat(newGoal.target_amount),
        deadline: newGoal.deadline,
        completed: false,
        current_amount: 0
      }]);

    if (error) {
      console.error('Error adding goal:', error);
      return;
    }

    setNewGoal({ title: '', target_amount: '', deadline: '' });
    setShowAddGoalModal(false);
    fetchGoals();
    
    // Award XP for creating a goal
    trackUserActivity('goal_created');

    if (!achievements.some(a => a.badge_id === 'goal_setter')) {
      await supabase
        .from('achievements')
        .insert([{
          user_id: user.id,
          badge_id: 'goal_setter',
        }]);
      fetchAchievements();
      
      trackUserActivity('achievement');
    }
  };

 const handleGoalCompletion = async (goal: Goal) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('goals')
      .update({ 
        completed: true,
        current_amount: goal.target_amount 
      })
      .eq('id', goal.id);

    if (error) {
      console.error('Error updating goal:', error);
      return;
    }

    alert(`🎉 Congratulations! You have achieved your goal: ${goal.title}`);
    fetchGoals();
    
    // Award XP for completing a goal
    trackUserActivity('goal_completed');
    
    // Check if user already has savings_champion badge
    const { data: existingBadge } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', user.id)
      .eq('badge_id', 'savings_champion')
      .maybeSingle();

    // If user doesn't have the badge yet, award it
    if (!existingBadge) {
      const { error: badgeError } = await supabase
        .from('achievements')
        .insert([{
          user_id: user.id,
          badge_id: 'savings_champion',
          notified: false
        }]);

      if (badgeError) {
        console.error('Error awarding badge:', badgeError);
      } else {
      
        fetchAchievements();
        checkNewAchievements();
      }
    }
  };

  const handleDeleteGoal = async (id: string) => {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting goal:', error);
      return;
    }

    fetchGoals();
  };

  const handleWishlistReview = async (item: WishlistItem, stillWantToBuy: boolean) => {
    if (stillWantToBuy) {
      navigate('/expenses');
    } else {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', item.id);

      if (error) {
        console.error('Error deleting wishlist item:', error);
        return;
      }
    }
    fetchWishlist();
  };

  const handleAddWishlistItem = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('wishlist')
      .insert([{
        user_id: user.id,
        title: newWishlistItem.title,
        price: parseFloat(newWishlistItem.price),
        reflection: newWishlistItem.reflection,
      }]);

    if (error) {
      console.error('Error adding wishlist item:', error);
      return;
    }

    setNewWishlistItem({ title: '', price: '', reflection: '' });
    setShowAddWishlistModal(false);
    fetchWishlist();
    
    trackUserActivity('wishlist_added');
  };

  const handleDeleteWishlistItem = async (id: string) => {
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting wishlist item:', error);
      return;
    }

    fetchWishlist();
  };

  const shareAchievement = async (achievement: Achievement) => {
    const badge = badges.find(b => b.id === achievement.badge_id);
    if (!badge) return;

    const text = `I just earned the ${badge.title} badge on Expenso! 🎉`;
    const url = window.location.origin;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Achievement Unlocked!',
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert('Achievement details copied to clipboard!');
      }

      await supabase
        .from('achievements')
        .update({ shared: true })
        .eq('id', achievement.id);

      fetchAchievements();
    } catch (error) {
      console.error('Error sharing achievement:', error);
    }
  };

  const pieChartData = {
    labels: categoryExpenses.map(item => item.category),
    datasets: [
      {
        data: categoryExpenses.map(item => item.amount),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ],
      },
    ],
  };

  const barChartData = {
    labels: dailyExpenses.map(item => item.date),
    datasets: [
      {
        label: 'Daily Expenses',
        data: dailyExpenses.map(item => item.amount),
        backgroundColor: '#36A2EB',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  useEffect(() => {
    const checkWishlistItems = async () => {
      const now = new Date();
      const items = wishlistItems.filter(
        item => !item.reviewed && new Date(item.can_buy_date) <= now
      );

      for (const item of items) {
        const shouldBuy = confirm(
          `Do you still want to buy "${item.title}"?\nPrice: ${currency.symbol}${item.price}`
        );

        await handleWishlistReview(item, shouldBuy);
      }
    };

    checkWishlistItems();
  }, [wishlistItems]);

  return (
    <div className="container mx-auto px-4 py-8">
      {showBadgeNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4 text-center">
            <Trophy className="w-16 h-16 text-yellow mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Achievement Unlocked!</h2>
            <p className="text-lg mb-4">{newBadge}</p>
            <Button
              onClick={() => setShowBadgeNotification(false)}
              variant="primary"
              className="w-full"
            >
              Awesome!
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <Camera className="w-8 h-8 text-gray-400" />
              </div>
            )}
          
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              Welcome, {profile?.first_name || 'User'}!
            </h1>
            <div className="mt-2 space-y-1">
              <p className="text-gray-600">Level {profile?.level || 1}</p>
              <div className="w-48 h-2 bg-gray-200 rounded-full">
                <div
                  className="h-full bg-yellow rounded-full"
                  style={{ width: `${((profile?.xp || 0) % 100)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">{profile?.xp || 0} XP</p>
              {profile?.occupation && (
                <p className="text-sm text-gray-600">{profile.occupation}</p>
              )}
              {profile?.bio && (
                <p className="text-sm text-gray-600">{profile.bio}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Achievements</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {badges.map(badge => {
            const achieved = achievements.some(a => a.badge_id === badge.id);
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-lg border text-center ${
                  achieved ? 'bg-yellow/10 border-yellow' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <badge.icon className={`w-8 h-8 mx-auto mb-2 ${
                  achieved ? 'text-yellow' : 'text-gray-400'
                }`} />
                <h3 className="font-medium text-sm">{badge.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
                {achieved && (
                  <button
                    onClick={() => shareAchievement(achievements.find(a => a.badge_id === badge.id)!)}
                    className="mt-2 text-xs text-yellow hover:text-yellow-600 flex items-center justify-center gap-1"
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Monthly Income</h2>
          <p className="text-3xl font-bold text-green-500">
            {currency.symbol}{totalIncome.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Monthly Expenses</h2>
          <p className="text-3xl font-bold text-red-500">
            {currency.symbol}{totalExpenses.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Balance</h2>
          <p className="text-3xl font-bold text-blue-500">
            {currency.symbol}{(totalIncome - totalExpenses).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Expense Categories</h2>
          <div className="h-64">
            <Pie data={pieChartData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Expenses</h2>
          <div className="h-64">
            <Bar data={barChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Financial Goals</h2>
            <Button
              onClick={() => setShowAddGoalModal(true)}
              variant="outline"
              className="text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Goal
            </Button>
          </div>
          <div className="space-y-4">
            {goals.map(goal => (
              <div key={goal.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={goal.completed}
                      onChange={() => !goal.completed && handleGoalCompletion(goal)}
                      className="mt-1"
                    />
                    <div>
                      <h3 className="font-medium">{goal.title}</h3>
                      <span className="text-sm text-gray-500">
                        Due: {new Date(goal.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full mb-2">
                  <div
                    className={`h-full rounded-full ${goal.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{
                      width: `${goal.completed ? 100 : (goal.current_amount / goal.target_amount) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{currency.symbol}{goal.current_amount}</span>
                  <span className="text-gray-500">
                    of {currency.symbol}{goal.target_amount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold">"Before You Buy" Wishlist</h2>
              <p className="text-sm text-gray-500">Wait 48 hours before making a purchase decision</p>
            </div>
            <Button
              onClick={() => setShowAddWishlistModal(true)}
              variant="outline"
              className="text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
          <div className="space-y-4">
            {wishlistItems.map(item => {
              const canBuyNow = new Date() > new Date(item.can_buy_date);

              return (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {currency.symbol}{item.price}
                      </span>
                      <button
                        onClick={() => handleDeleteWishlistItem(item.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    Added: {new Date(item.added_date).toLocaleDateString()}
                  </div>
                  {!canBuyNow && (
                    <div className="text-sm text-yellow">
                      Can buy after: {new Date(item.can_buy_date).toLocaleDateString()}
                    </div>
                  )}
                  {item.reflection && (
                    <p className="text-sm text-gray-600 mt-2">
                      Reflection: {item.reflection}
                    </p>
                  )}
                  {canBuyNow && !item.reviewed && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={() => handleWishlistReview(item, true)}
                        variant="primary"
                        className="text-sm"
                      >
                        Yes, I want to buy
                      </Button>
                      <Button
                        onClick={() => handleWishlistReview(item, false)}
                        variant="outline"
                        className="text-sm"
                      >
                        No, remove item
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <Crown className="w-6 h-6 text-yellow" />
        </div>
        <div className="flex flex-col items-center justify-center h-48">
          <img
            src="https://images.pexels.com/photos/7376/startup-photos.jpg?auto=compress&cs=tinysrgb&w=800"
            alt="Coming Soon"
            className="w-32 h-32 object-cover rounded-lg mb-4 opacity-50"
          />
          <p className="text-gray-500 font-medium">Coming Soon!</p>
          <p className="text-sm text-gray-400">Compete with friends and earn rewards</p>
        </div>
      </div>

      {showAddGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Add Financial Goal</h2>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Goal Title</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Amount ({currency.symbol})
                </label>
                <input
                  type="number"
                  value={newGoal.target_amount}
                  onChange={(e) => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deadline</label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setShowAddGoalModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Goal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddWishlistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Add to Wishlist</h2>
            <p className="text-sm text-gray-500 mb-4">
              Items added to the wishlist have a 48-hour cooling period before purchase.
              Use this time to reflect on whether you really need this item.
            </p>
            <form onSubmit={handleAddWishlistItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item Name</label>
                <input
                  type="text"
                  value={newWishlistItem.title}
                  onChange={(e) => setNewWishlistItem({ ...newWishlistItem, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price ({currency.symbol})</label>
                <input
                  type="number"
                  value={newWishlistItem.price}
                  onChange={(e) => setNewWishlistItem({ ...newWishlistItem, price: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Initial Reflection</label>
                <textarea
                  value={newWishlistItem.reflection}
                  onChange={(e) => setNewWishlistItem({ ...newWishlistItem, reflection: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder="Why do you want this item? How will it improve your life?"
                ></textarea>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setShowAddWishlistModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add to Wishlist
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;