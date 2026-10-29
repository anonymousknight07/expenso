import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../contexts/CurrencyContext';
import { ALL_BADGES, syncUserXPAndAchievements } from '../lib/achievements';


import {
  Camera,
  Trophy,
  Star,
  Brain,
  Heart,
  ThumbsUp,
  Target,
  Plus,
  Share2,
  Crown,
  Trash2,
  X,
  Smile,
  Frown,
  Coffee,
  Meh,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Quote,
  Zap,
  ScanLine,
  Receipt,
  ChevronRight,
  ChevronLeft,
  Bell,
  Calendar,
  Lock,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Award,
  Gift,
} from "lucide-react";
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

// Dark-theme chart defaults
ChartJS.defaults.color = "#b3b3b3";
ChartJS.defaults.borderColor = "rgba(255, 255, 255, 0.08)";

// One quote per day — indexed by day of year so it rotates daily
const SAVING_QUOTES: { text: string; author: string }[] = [
  { text: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett" },
  { text: "A budget is telling your money where to go instead of wondering where it went.", author: "Dave Ramsey" },
  { text: "Beware of little expenses; a small leak will sink a great ship.", author: "Benjamin Franklin" },
  { text: "The habit of saving is itself an education; it fosters every virtue.", author: "T.T. Munger" },
  { text: "It's not your salary that makes you rich, it's your spending habits.", author: "Charles A. Jaffe" },
  { text: "Never spend your money before you have it.", author: "Thomas Jefferson" },
  { text: "The art is not in making money, but in keeping it.", author: "Proverb" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { text: "Small amounts saved daily add up to huge investments in the end.", author: "Margo Vader" },
  { text: "Money looks better in the bank than on your feet.", author: "Sophia Amoruso" },
  { text: "Save money, and money will save you.", author: "Jamaican Proverb" },
  { text: "He who buys what he does not need steals from himself.", author: "Swedish Proverb" },
  { text: "The quickest way to double your money is to fold it and put it back in your pocket.", author: "Will Rogers" },
  { text: "Financial freedom is available to those who learn about it and work for it.", author: "Robert Kiyosaki" },
  { text: "Every time you borrow money, you're robbing your future self.", author: "Nathan W. Morris" },
  { text: "A penny saved is a penny earned.", author: "Benjamin Franklin" },
  { text: "Rich people stay rich by living like they're broke.", author: "Unknown" },
  { text: "Don't tell me what you value. Show me your budget, and I'll tell you what you value.", author: "Joe Biden" },
  { text: "You must gain control over your money or the lack of it will forever control you.", author: "Dave Ramsey" },
  { text: "The goal isn't more money. The goal is living life on your terms.", author: "Chris Brogan" },
  { text: "Spend not where you may save; spare not where you must spend.", author: "John Ray" },
  { text: "Look everywhere you can to cut a little bit from your expenses. It will all add up.", author: "Suze Orman" },
  { text: "If you buy things you do not need, soon you will have to sell things you need.", author: "Warren Buffett" },
  { text: "Money grows on the tree of persistence.", author: "Japanese Proverb" },
  { text: "It is thrifty to prepare today for the wants of tomorrow.", author: "Aesop" },
  { text: "Try to save something while your salary is small; it's impossible to save after you begin to earn more.", author: "Jack Benny" },
  { text: "Being in control of your finances is a great stress reliever.", author: "Unknown" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Frugality includes all the other virtues.", author: "Cicero" },
  { text: "Balancing your money is the key to having enough.", author: "Elizabeth Warren" },
];

const getDayOfYear = (d: Date) => {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
};

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  health_score?: number;
  bio?: string;
  occupation?: string;
  last_active?: string;
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

const ICON_MAP: Record<string, any> = {
  Crown,
  Flame,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Trophy,
  Award,
  Target,
  Wallet,
  TrendingUp,
  Gift,
  Zap,
  Receipt,
};

const Chara = [
  'https://cdn.sanity.io/images/rh8hx4sn/production/4f5b7078f0f8815586be2a046e5a372546f95ffc-1024x1024.png',
  'https://cdn.sanity.io/images/rh8hx4sn/production/04fc1360172498ebf4d4f70e9ae1c97df820203c-1024x1024.png',
];

const Scene = [
  'https://cdn.sanity.io/images/rh8hx4sn/production/7d833e1a376996e9990bee29c23f4fa302535a59-183x275.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/6da2a15ccb2cf6345248e24d6786f291ef31e832-168x300.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/042eb85967b1cf069617546795fc317e905d7a88-850x531.webp',
  'https://cdn.sanity.io/images/rh8hx4sn/production/2b30c8a592fcf5ef0884f698bbba205573428e7f-347x540.jpg',
];

const Heroes = [
  'https://cdn.sanity.io/images/rh8hx4sn/production/9ac7ff586aa851056da1fefe114d55f8cbe5c05f-1024x576.webp',
  'https://cdn.sanity.io/images/rh8hx4sn/production/10786e8bfb6abd9c391dacdfa1768acee0020088-640x480.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/f6bfcd3d66568ed63b9c88fa3476d1767737d747-206x245.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/a60b37cb08820d222ecaf90ca1532837818d3a16-900x450.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/d0a8957923fb8c33900bd30118ed8053849e5c5c-900x450.jpg',
];

const series = [
  'https://cdn.sanity.io/images/rh8hx4sn/production/5c76b1d0aa2ea83496b7feae26c72b29cab8daf9-183x275.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/cf2e7f76ce751f0607c61f77e71f81f93654eb52-564x789.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/7c5cc5a54c5db2f25beea9ad630947a6e045f171-1280x720.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/50bd70094b674c47a0674bb82f5af4fef85277f0-225x225.jpg',
];

const quotes = [
  'https://cdn.sanity.io/images/rh8hx4sn/production/91b3720ae25ced37f1317d7bd61f39e7303f70d3-800x800.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/76108ec155e52fa810670860b1b74a3a807014eb-183x275.png',
  'https://cdn.sanity.io/images/rh8hx4sn/production/63e5c7fb3663b86881f5e0e45c6661cdce7446e2-225x225.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/2b44e76fa17201b11c28f93a8dbbe788d260915a-1200x1003.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/28eb7dc4e4bdb10adf6e11c0421fbab2a460c0d3-1200x1200.jpg',
];

const anime = [
  'https://cdn.sanity.io/images/rh8hx4sn/production/b4bbc9c2f97ffda393a6a85012bc88bb00dc995b-554x554.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/cb215e32efcb6393773e40328b2d8b4f5875b802-6860x5144.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/ed2f0ce1bbfc4601e61b13a5cdb9f8377a825ed6-1000x1000.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/2da13bb38ef1859b7d082cf17f6c931f7621263a-900x1600.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/d0075dd35eda4eb06aba6ed3dd9b8d9cdc7cb944-236x236.jpg',
  'https://cdn.sanity.io/images/rh8hx4sn/production/eb0999f5db0141e3a6920709958ddb0fdc420333-1024x1024.jpg'
];

const avatarCategories = {
  charater: { name: 'Character', avatars: Chara },
  scene: { name: 'Scene', avatars: Scene },
  professional: { name: 'Heroes', avatars: Heroes },
  diverse: { name: 'Series', avatars: series },
  illustrated: { name: 'Quotes', avatars: quotes },
  generated: { name: 'Anime', avatars: anime }
};

type AvatarCategoryKey = keyof typeof avatarCategories;

const Dashboard = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [dailyExpenses, setDailyExpenses] = useState<any[]>([]);
  const [categoryExpenses, setCategoryExpenses] = useState<
    { category: string; amount: number }[]
  >([]);
  const [recentExpenses, setRecentExpenses] = useState<
    { id: string; amount: number; description: string; date: string }[]
  >([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedAvatarCategory, setSelectedAvatarCategory] = useState<AvatarCategoryKey>('charater');
  const [userMood, setUserMood] = useState<string | null>(null);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [moodStats, setMoodStats] = useState<any[]>([]);
  const [equippedFrameClass, setEquippedFrameClass] = useState("border-2 border-white/20");
  const [equippedTitle, setEquippedTitle] = useState<string | null>(null);



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
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );

  const { currency, payCycleType, salaryDay, getPayCycleRange, calculateEffectiveIncome } = useCurrency();
  const navigate = useNavigate();

  useEffect(() => {
    fetchFinancialData(selectedMonth);
    fetchRecentExpenses(selectedMonth);
  }, [selectedMonth, payCycleType, salaryDay]);

  const changeMonth = (offset: number) => {
    const baseMonth =
      selectedMonth === "all"
        ? new Date().toISOString().slice(0, 7)
        : selectedMonth;
    const [year, month] = baseMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const fetchFinancialData = async (monthToUse = selectedMonth) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cycleRange = getPayCycleRange(monthToUse);
    const startOfMonth = cycleRange.startDateStr;
    const endOfMonth = cycleRange.endDateStr;

    const monthlyIncome = await calculateEffectiveIncome(monthToUse);
    setTotalIncome(monthlyIncome);

    let query = supabase
      .from('expenses')
      .select(`
        amount,
        date,
        expense_category_mappings (
          expense_categories (
            name,
            color
          )
        )
      `)
      .eq('user_id', user.id);

    if (monthToUse !== 'all') {
      query = query.gte('date', startOfMonth).lte('date', endOfMonth);
    }

    const { data: expensesData } = await query;

    if (expensesData) {
      const totalExp = expensesData.reduce((sum, exp) => sum + exp.amount, 0);
      setTotalExpenses(totalExp);

      const dailyExp = expensesData.reduce((acc: Record<string, number>, exp: any) => {
        const date = new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        acc[date] = (acc[date] || 0) + exp.amount;
        return acc;
      }, {});
      setDailyExpenses(Object.entries(dailyExp).map(([date, amount]) => ({ date, amount })));

      const categoryExp = expensesData.reduce((acc: Record<string, number>, exp) => {
        const mapping: any = Array.isArray(exp.expense_category_mappings)
          ? exp.expense_category_mappings[0]
          : exp.expense_category_mappings;
        const cat = Array.isArray(mapping?.expense_categories)
          ? mapping.expense_categories[0]
          : mapping?.expense_categories;
        const category = cat?.name ?? "Uncategorized";
        acc[category] = (acc[category] || 0) + exp.amount;
        return acc;
      }, {});
      setCategoryExpenses(Object.entries(categoryExp).map(([category, amount]) => ({ category, amount })));
    } else {
      setTotalExpenses(0);
      setDailyExpenses([]);
      setCategoryExpenses([]);
    }
  };

  const quoteOfTheDay =
    SAVING_QUOTES[getDayOfYear(new Date()) % SAVING_QUOTES.length];
  const hourNow = new Date().getHours();
  const greeting =
    hourNow < 12 ? "Good morning" : hourNow < 17 ? "Good afternoon" : "Good evening";
  const balance = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);


  const moodOptions = [
    {
      id: "happy",
      label: "Happy",
      emoji: "😊",
      icon: Smile,
      color: "bg-emerald-500/15 text-emerald-300",
    },
    {
      id: "neutral",
      label: "Neutral",
      emoji: "😐",
      icon: Meh,
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      id: "sad",
      label: "Sad",
      emoji: "😢",
      icon: Frown,
      color: "bg-sky-500/15 text-sky-300",
    },
    {
      id: "stressed",
      label: "Stressed",
      emoji: "😰",
      color: "bg-red-500/15 text-red-300",
    },
    {
      id: "excited",
      label: "Excited",
      emoji: "🤩",
      color: "bg-purple-500/15 text-purple-300",
    },
    {
      id: "tired",
      label: "Tired",
      emoji: "😴",
      color: "bg-white/10 text-gray-100",
    },
    {
      id: "Motivated",
      label: "Motivated",
      emoji: "💪",
      icon: Star,
      color: "bg-red-500/15 text-red-300",
    },
    {
      id: "Grateful",
      label: "Grateful",
      emoji: "🙏",
      icon: Heart,
      color: "bg-pink-500/15 text-pink-300",
    },
    {
      id: "Energetic",
      label: "Energetic",
      emoji: "⚡",
      icon: Coffee,
      color: "bg-black-100 text-white-800",
    },
  ];




useEffect(() => {
  fetchProfile();
  fetchFinancialData();
  fetchRecentExpenses();
  fetchGoals();
  fetchWishlist();
  fetchTodaysMood();
  fetchMoodStats();
  fetchLeaderboard();
  
  const initializeAchievements = async () => {
    await fetchAchievements();
    await checkNewAchievements();
  };
  
  initializeAchievements();
  trackUserActivity('dashboard_visit');
}, []);

const fetchLeaderboard = async () => {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, xp, level, username")
      .order("xp", { ascending: false })
      .limit(10);

    if (error) throw error;

    setLeaderboard(data || []);

  
    if (data) {
      const rank = data.findIndex((u) => u.id === authUser.id) + 1;
      setCurrentUserRank(rank > 0 ? rank : null);
    }
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
  }
};

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
      if (!data.avatar_url) {
        setShowAvatarModal(true);
      }

      try {
        const saved = null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.equippedFrame) {
            const item = null as any;
            if (item?.previewClass) {
              setEquippedFrameClass(item.previewClass);
            }
          }
          if (parsed.equippedTitle) {
            setEquippedTitle(parsed.equippedTitle);
          }
        }
      } catch (e) {}
    }
  };

  const fetchRecentExpenses = async (monthToUse = selectedMonth) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("expenses")
      .select("id, amount, description, date")
      .eq("user_id", user.id);

    if (monthToUse !== 'all') {
      const cycleRange = getPayCycleRange(monthToUse);
      query = query.gte("date", cycleRange.startDateStr).lte("date", cycleRange.endDateStr);
    }

    const { data } = await query.order("date", { ascending: false }).limit(6);
    setRecentExpenses(data || []);
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
    .eq('user_id', user.id)
    .order('added_date', { ascending: false });

  if (error) {
    console.error('Error fetching wishlist:', error);
    return;
  }

 
  const formattedData = (data || []).map(item => ({
    ...item,
    
    added_date: item.added_date || new Date().toISOString(),
    can_buy_date: item.can_buy_date || new Date(new Date().getTime() + 48 * 60 * 60 * 1000).toISOString(),
    reviewed: !!item.reviewed
  }));

  setWishlistItems(formattedData);
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
 const fetchTodaysMood = async () => {
   const {
     data: { user },
   } = await supabase.auth.getUser();
   if (!user) return;

   const today = new Date().toISOString().split("T")[0]; // "2026-05-10"

   const { data, error } = await supabase
     .from("mood_tracker")
     .select("mood")
     .eq("user_id", user.id)
     .eq("date", today) // simple equality on DATE column
     .maybeSingle();

   if (!error && data) {
     setUserMood(data.mood);
   }
 };

  // Fetch mood statistics for chart
  const fetchMoodStats = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("mood_tracker")
      .select("mood, date")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo.toISOString())
      .order("date", { ascending: true });

    if (!error && data) {
      const stats = moodOptions.map((option) => {
        const count = data.filter((entry) => entry.mood === option.id).length;
        return {
          mood: option.label,
          count,
          percentage: Math.round((count / data.length) * 100) || 0,
          color: option.color,
        };
      });
      setMoodStats(stats);
    }
  };

  // Log mood to database
  const logMood = async (mood: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Use DATE format only — the conflict key is (user_id, date) where date is DATE type
    const today = new Date().toISOString().split("T")[0]; // "2026-05-10"

    const { error } = await supabase.from("mood_tracker").upsert(
      {
        user_id: user.id,
        mood,
        date: today, // DATE column needs "YYYY-MM-DD" not full ISO string
        // removed auth_user_id — doesn't exist in schema
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      console.error("Error logging mood:", error);
      return;
    }

    setUserMood(mood);
    setShowMoodModal(false);
    trackUserActivity("mood_logged");
    fetchMoodStats();
  };


  const trackUserActivity = async (activityType: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Call syncUserXPAndAchievements to evaluate achievements and update profile in database
    const result = await syncUserXPAndAchievements(user.id);

    // Update local profile state
    setProfile(prev => prev ? {
      ...prev,
      xp: result.totalXp,
      level: result.level
    } : null);

    // Also fetch achievements list to update local achievements state (which feeds the "Your Achievements" UI)
    await fetchAchievements();

    // Check for daily login last_active tracking
    if (activityType === 'dashboard_visit' || activityType === 'login') {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('last_active')
        .eq('id', user.id)
        .single();
      
      const today = new Date().toDateString();
      const lastActive = profileData?.last_active
        ? new Date(profileData.last_active).toDateString()
        : null;

      if (today !== lastActive) {
        await supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', user.id);
      }
    }

    // Trigger check for new achievements (so user gets visual popup)
    await checkNewAchievements();
  };


 const checkNewAchievements = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;


  const { data: newAchievements, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', user.id)
    .eq('notified', false);

  if (error) {
    console.error('Error fetching achievements:', error);
    return;
  }

  
  if (newAchievements && newAchievements.length > 0) {
    const achievement = newAchievements[0];
    const badge = ALL_BADGES.find(b => b.id === achievement.badge_id);
    
    if (badge) {
      setNewBadge(badge.title);
      setShowBadgeNotification(true);

     
      await supabase
        .from('achievements')
        .update({ notified: true })
        .eq('id', achievement.id);
        
      
      trackUserActivity('achievement');
    }
  }
};

const handleAddGoal = async (e: React.FormEvent) => {
  e.preventDefault();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;


  const { data: existingGoals, error: fetchError } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', user.id);

  if (fetchError) {
    console.error('Error checking existing goals:', fetchError);
    return;
  }

  const isFirstGoal = existingGoals.length === 0;


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

  trackUserActivity('goal_created');

 
  if (isFirstGoal) {
    awardAchievement('goal_setter');
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

  trackUserActivity('goal_completed');

  // awardAchievement('savings_champion');
  
  alert(`🎉 Congratulations! You have achieved your goal: ${goal.title}`);
  fetchGoals();
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

const awardAchievement = async (badgeId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  

  const { data: existingBadge } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', user.id)
    .eq('badge_id', badgeId)
    .maybeSingle();

  if (!existingBadge) {
    const { error: badgeError } = await supabase
      .from('achievements')
      .insert([{
        user_id: user.id,
        badge_id: badgeId,
        unlocked_at: new Date().toISOString(),
        notified: false,
        shared: false
      }]);

    if (badgeError) {
      console.error('Error awarding badge:', badgeError);
    } else {
   
      fetchAchievements();
      checkNewAchievements();
    }
  }
};

const handleWishlistReview = async (item: WishlistItem, stillWantToBuy: boolean) => {
  if (stillWantToBuy) {
    // If user still wants to buy, mark as reviewed but keep in wishlist
    const { error } = await supabase
      .from('wishlist')
      .update({ reviewed: true })
      .eq('id', item.id);
      
    if (error) {
      console.error('Error updating wishlist item:', error);
    } else {
      // Redirect to expenses page to record the purchase
      navigate('/expenses');
    }
  } else {
   
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', item.id);

    if (error) {
      console.error('Error deleting wishlist item:', error);
    }
  }
  
 
  fetchWishlist();
};

  const handleAddWishlistItem = async (e: React.FormEvent) => {
  e.preventDefault();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

 
  const now = new Date();
  const canBuyDate = new Date(now.getTime() + 48 * 60 * 60 * 1000); 

  const { error } = await supabase
    .from('wishlist')
    .insert([{
      user_id: user.id,
      title: newWishlistItem.title,
      price: parseFloat(newWishlistItem.price),
      reflection: newWishlistItem.reflection,
      added_date: now.toISOString(),
      can_buy_date: canBuyDate.toISOString(),
      reviewed: false
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
    const badge = ALL_BADGES.find(b => b.id === achievement.badge_id);
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
    
    
    const readyForReviewItems = wishlistItems.filter(
      item => !item.reviewed && new Date(item.can_buy_date) <= now
    );
    
    
    for (const item of readyForReviewItems) {
     
      const shouldBuy = window.confirm(
        `Do you still want to buy "${item.title}"?\nPrice: ${currency.symbol}${item.price}`
      );

    
      await handleWishlistReview(item, shouldBuy);
    }
  };

  if (wishlistItems.length > 0) {
    checkWishlistItems();
  }
}, [wishlistItems]);

  const currentActiveRange = getPayCycleRange();
  const diffMs = currentActiveRange.endDate.getTime() - new Date().getTime();
  const daysRemainingInCycle = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isCycleEndingSoon = daysRemainingInCycle >= 0 && daysRemainingInCycle <= 5;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* End-of-Period Notification Banner */}
      {isCycleEndingSoon && (
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-orange-500/20 border border-yellow/40 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-yellow/5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-yellow/20 text-yellow flex items-center justify-center flex-shrink-0 border border-yellow/30 shadow-inner">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-base sm:text-lg">Pay Cycle Ending Soon!</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow/20 text-yellow font-bold border border-yellow/30">
                  {daysRemainingInCycle === 0 ? "Ends Today" : `${daysRemainingInCycle} day${daysRemainingInCycle === 1 ? "" : "s"} left`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 mt-1">
                Your active pay cycle (<span className="font-semibold text-yellow-300">{currentActiveRange.label}</span>) is ending. Create your monthly spending report to view detailed financial insights!
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/reports")}
            variant="primary"
            className="w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap flex items-center justify-center gap-2 accent-gradient shadow-md px-5 py-2.5 font-semibold"
          >
            <BarChart3 className="w-4 h-4" />
            Create Spending Report
          </Button>
        </div>
      )}
      {showBadgeNotification && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-sm w-full mx-4 text-center">
            <Trophy className="w-16 h-16 text-yellow mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Achievement Unlocked!</h2>
            <p className="text-lg mb-4">{newBadge}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  const achievement = achievements.find(
                    (a) =>
                      a.badge_id ===
                      ALL_BADGES.find((b) => b.title === newBadge)?.id
                  );
                  if (achievement) shareAchievement(achievement);
                  setShowBadgeNotification(false);
                }}
                variant="primary"
                className="w-full flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Share Achievement
              </Button>
              <Button
                onClick={() => setShowBadgeNotification(false)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero: greeting + daily savings quote */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className={`w-24 h-24 rounded-full object-cover transition-all ${equippedFrameClass}`}
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face";
                  }}
                />
              ) : (
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center cursor-pointer transition-all ${equippedFrameClass}`}
                  onClick={() => setShowAvatarModal(true)}
                >
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
              )}

              <button
                onClick={() => setShowAvatarModal(true)}
                className="absolute -bottom-1 -right-1 accent-gradient text-white rounded-full p-1.5 hover:brightness-110 transition-all shadow-md shadow-yellow/30"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm text-gray-400">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold mt-0.5">
                {greeting}, {profile?.first_name || "there"}!
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                <span className="glass-chip px-3 py-1 text-xs font-semibold text-yellow-300">
                  Level {profile?.level || 1}
                </span>
                {equippedTitle && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow/20 text-yellow border border-yellow/40 flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    {equippedTitle}
                  </span>
                )}
                <div className="w-40 h-2 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full accent-gradient rounded-full transition-all"
                    style={{ width: `${((profile?.xp || 0) % 150) / 150 * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-400">{profile?.xp || 0} XP</span>
              </div>
              {profile?.occupation && (
                <p className="text-sm text-gray-300 mt-2">{profile.occupation}</p>
              )}
            </div>
          </div>
        </div>

        {/* Daily Savings Quote */}
        <div className="glass-card p-6 border-yellow/20 flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-300 mb-2">
            Thought for today
          </p>
          <p className="text-lg font-medium leading-snug text-white">
            “{quoteOfTheDay.text}”
          </p>
          <p className="text-sm text-gray-400 mt-3">— {quoteOfTheDay.author}</p>
        </div>
      </div>

      {/* Penny AI Assistant Spotlight */}
      <div className="glass-card p-6 mb-8 border border-white/10 hover:border-yellow/30 transition-all bg-gradient-to-r from-white/[0.04] to-yellow/[0.02]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff3c02] to-amber-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-[#ff3c02]/20">
              💬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Penny AI Finance Assistant</h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                Record expenses, income, and get instant financial insights through natural conversation.
              </p>
            </div>
          </div>
          <Link
            to="/assistant"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff3c02] to-amber-500 text-white font-medium text-sm hover:opacity-90 shadow-lg shadow-[#ff3c02]/20 transition-all whitespace-nowrap"
          >
            Chat with Penny &rarr;
          </Link>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 font-medium mr-1">Try saying:</span>
          {[
            "I spent ₹450 on dinner yesterday",
            "I got my salary today",
            "How much did I spend this month?",
            "Compare this month with last month",
          ].map((prompt, idx) => (
            <Link
              key={idx}
              to={`/assistant?q=${encodeURIComponent(prompt)}`}
              className="text-xs px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-yellow/40 transition-colors"
            >
              "{prompt}"
            </Link>
          ))}
        </div>
      </div>

      {/* Mood Tracker Section */}
      <div className="glass-card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">
          How's Your Spending Mood?
        </h2>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Today's Mood */}
          <div className="glass-inset p-4 flex-1">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Today's Mood</h3>
              <Button
                onClick={() => setShowMoodModal(true)}
                variant="outline"
                size="sm"
              >
                {userMood ? "Change Mood" : "Log Mood"}
              </Button>
            </div>

            {userMood ? (
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    moodOptions.find((m) => m.id === userMood)?.color ||
                    "bg-white/15"
                  }`}
                >
                  {moodOptions.find((m) => m.id === userMood)?.emoji}
                </div>
                <div>
                  <p className="font-medium">
                    {moodOptions.find((m) => m.id === userMood)?.label}
                  </p>
                  <p className="text-sm text-gray-400">Logged today</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-2">No mood logged today</p>
                <Button
                  onClick={() => setShowMoodModal(true)}
                  variant="primary"
                >
                  Log Your Mood
                </Button>
              </div>
            )}
          </div>

          {/* Mood Statistics */}
          <div className="glass-inset p-4 flex-1">
            <h3 className="font-medium mb-3">Mood Insights (Last 30 Days)</h3>
            <div className="space-y-2">
              {moodStats
                .filter((s) => s.count > 0)
                .map((stat) => (
                  <div key={stat.mood} className="flex items-center">
                    <div className="w-24 flex-shrink-0">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${stat.color}`}
                      >
                        {stat.mood}
                      </span>
                    </div>
                    <div className="flex-1 ml-2">
                      <div className="w-full bg-white/15 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${stat.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="w-10 text-right text-sm text-gray-400">
                      {stat.count}
                    </div>
                  </div>
                ))}

              {moodStats.filter((s) => s.count > 0).length === 0 && (
                <p className="text-gray-400 text-center py-2">
                  No mood data available
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Achievements</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {ALL_BADGES.map((badge) => {
            const achieved = achievements.some((a) => a.badge_id === badge.id);
            const IconComponent = ICON_MAP[badge.iconName] || Trophy;
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-lg border text-center transition-all ${
                  achieved
                    ? "bg-yellow/10 border-yellow/40 text-yellow shadow-md shadow-yellow/5"
                    : "bg-white/5 border-white/10 opacity-70"
                }`}
              >
                {achieved ? (
                  <IconComponent className="w-8 h-8 mx-auto mb-2 text-yellow" />
                ) : (
                  <Lock className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                )}
                <h3 className="font-semibold text-xs truncate text-white">{badge.title}</h3>
                <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-tight">
                  {badge.description}
                </p>
                {achieved && (
                  <button
                    onClick={() =>
                      shareAchievement(
                        achievements.find((a) => a.badge_id === badge.id)!
                      )
                    }
                    className="mt-2 mx-auto text-[10px] text-yellow hover:text-yellow-600 flex items-center justify-center gap-1 font-semibold"
                  >
                    <Share2 className="w-2.5 h-2.5" />
                    Share
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cycle Preference & Range Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Period Overview</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-gray-300 border border-white/10 uppercase tracking-wider">
                {payCycleType === 'salary' ? `Payday (${salaryDay}th)` : 'Calendar Month'}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Showing stats for: <span className="text-yellow-300 font-medium">{selectedMonth === 'all' ? 'All Time' : getPayCycleRange(selectedMonth).label}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Previous cycle"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-white min-w-[100px] text-center truncate">
              {selectedMonth === 'all' ? 'All Time' : getPayCycleRange(selectedMonth).shortLabel}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Next cycle"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setSelectedMonth(selectedMonth === 'all' ? new Date().toISOString().slice(0, 7) : 'all')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              selectedMonth === 'all'
                ? 'bg-yellow/20 text-yellow border-yellow/40'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {selectedMonth === 'all' ? 'Current Cycle' : 'All Time'}
          </button>
        </div>
      </div>

      {/* Period summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </span>
            <h2 className="text-sm font-medium text-gray-300">Income</h2>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white">
            {currency.symbol}
            {totalIncome.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {selectedMonth === 'all' ? 'all time' : getPayCycleRange(selectedMonth).label}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </span>
            <h2 className="text-sm font-medium text-gray-300">Expenses</h2>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white">
            {currency.symbol}
            {totalExpenses.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {totalIncome > 0
              ? `${Math.min(999, Math.round((totalExpenses / totalIncome) * 100))}% of income`
              : selectedMonth === 'all' ? 'all time' : 'selected period'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-sky-400" />
            </span>
            <h2 className="text-sm font-medium text-gray-300">Balance</h2>
          </div>
          <p
            className={`text-2xl md:text-3xl font-bold ${
              balance >= 0 ? "text-white" : "text-red-400"
            }`}
          >
            {currency.symbol}
            {balance.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">left to spend or save</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-yellow/15 flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-yellow-300" />
            </span>
            <h2 className="text-sm font-medium text-gray-300">Savings rate</h2>
          </div>
          <p
            className={`text-2xl md:text-3xl font-bold ${
              savingsRate >= 20
                ? "text-emerald-400"
                : savingsRate >= 0
                ? "text-yellow-300"
                : "text-red-400"
            }`}
          >
            {savingsRate}%
          </p>
          <div className="w-full h-1.5 bg-white/15 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full accent-gradient rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Add Expense", icon: Plus, onClick: () => navigate("/expenses") },
          { label: "UPI Sync", icon: Zap, onClick: () => navigate("/upi-sync") },
          { label: "Scan Receipt", icon: ScanLine, onClick: () => navigate("/receipt-scanner") },
          { label: "New Goal", icon: Target, onClick: () => setShowAddGoalModal(true) },
        ].map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="glass-inset p-4 flex items-center gap-3 hover:bg-white/10 hover:border-yellow/40 transition-all group"
          >
            <span className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-md shadow-yellow/25 group-hover:scale-110 transition-transform">
              <action.icon className="w-4 h-4 text-white" />
            </span>
            <span className="text-sm font-semibold text-white">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Charts + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Expense Categories</h2>
          <div className="h-64">
            <Pie data={pieChartData} options={chartOptions} />
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Expenses</h2>
          <div className="h-64">
            <Bar data={barChartData} options={chartOptions} />
          </div>
        </div>
        <div className="glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <button
              onClick={() => navigate("/expenses")}
              className="text-xs font-medium text-yellow-300 hover:text-yellow-200 flex items-center gap-0.5 transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentExpenses.length > 0 ? (
            <div className="space-y-3 flex-1">
              {recentExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-4 h-4 text-red-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {exp.description || "Expense"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(exp.date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-red-400 whitespace-nowrap">
                    −{currency.symbol}
                    {exp.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <Receipt className="w-8 h-8 text-gray-500 mb-2" />
              <p className="text-sm text-gray-400">No expenses yet</p>
              <p className="text-xs text-gray-500">Add one to see it here</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glass-card p-6">
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
            {goals.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={goal.completed}
                      onChange={() =>
                        !goal.completed && handleGoalCompletion(goal)
                      }
                      className="mt-1"
                    />
                    <div>
                      <h3 className="font-medium">{goal.title}</h3>
                      <span className="text-sm text-gray-400">
                        Due: {new Date(goal.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-red-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-full h-2 bg-white/15 rounded-full mb-2">
                  <div
                    className={`h-full rounded-full ${
                      goal.completed ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{
                      width: `${
                        goal.completed
                          ? 100
                          : (goal.current_amount / goal.target_amount) * 100
                      }%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>
                    {currency.symbol}
                    {goal.current_amount}
                  </span>
                  <span className="text-gray-400">
                    of {currency.symbol}
                    {goal.target_amount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                "Before You Buy" Wishlist
              </h2>
              <p className="text-sm text-gray-400">
                Wait 48 hours before making a purchase decision
              </p>
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
            {wishlistItems.map((item) => {
              const canBuyDate = new Date(item.can_buy_date || "");
              const addedDate = new Date(item.added_date || "");
              const canBuyNow = new Date() > canBuyDate;

              return (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {currency.symbol}
                        {item.price}
                      </span>
                      {canBuyNow && (
                        <button
                          onClick={() => handleDeleteWishlistItem(item.id)}
                          className="text-red-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    Added: {addedDate.toLocaleDateString()}
                  </div>
                  {!canBuyNow && (
                    <div className="text-sm text-yellow">
                      Cooling period ends: {canBuyDate.toLocaleDateString()} at{" "}
                      {canBuyDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                  {item.reflection && (
                    <p className="text-sm text-gray-300 mt-2">
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

      {/* <div className="glass-card p-6">
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
          <p className="text-gray-400 font-medium">Coming Soon!</p>
          <p className="text-sm text-gray-400">
            Compete with friends and earn rewards
          </p>
        </div>
      </div> */}

      {showAddGoalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Add Financial Goal</h2>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Target Amount ({currency.symbol})
                </label>
                <input
                  type="number"
                  value={newGoal.target_amount}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, target_amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, deadline: e.target.value })
                  }
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Add to Wishlist</h2>
            <p className="text-sm text-gray-400 mb-4">
              Items added to the wishlist have a 48-hour cooling period before
              purchase. Use this time to reflect on whether you really need this
              item.
            </p>
            <form onSubmit={handleAddWishlistItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={newWishlistItem.title}
                  onChange={(e) =>
                    setNewWishlistItem({
                      ...newWishlistItem,
                      title: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Price ({currency.symbol})
                </label>
                <input
                  type="number"
                  value={newWishlistItem.price}
                  onChange={(e) =>
                    setNewWishlistItem({
                      ...newWishlistItem,
                      price: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Initial Reflection
                </label>
                <textarea
                  value={newWishlistItem.reflection}
                  onChange={(e) =>
                    setNewWishlistItem({
                      ...newWishlistItem,
                      reflection: e.target.value,
                    })
                  }
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
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <Crown className="w-6 h-6 text-yellow" />
        </div>

        <div className="space-y-4">
          {leaderboard.map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center gap-4 p-3 rounded-lg ${
                profile?.id === user.id
                  ? "bg-yellow-50 border border-yellow-200"
                  : ""
              }`}
            >
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-full text-white font-bold ${
                  index === 0
                    ? "bg-yellow-500"
                    : index === 1
                    ? "bg-gray-400"
                    : index === 2
                    ? "bg-yellow-700"
                    : "bg-white/20"
                }`}
              >
                {index + 1}
              </span>

              <img
                src={
                  user.avatar_url ||
                  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face"
                }
                alt={user.first_name}
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) =>
                  (e.currentTarget.src =
                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face")
                }
              />

              <div className="flex-1">
                <h3 className="font-medium">
                  {user.first_name} {user.last_name}
                  {profile?.id === user.id && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      You
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-400">@{user.username}</p>
              </div>

              <div className="text-right">
                <p className="font-semibold">Lvl {user.level}</p>
                <p className="text-sm text-gray-400">{user.xp} XP</p>
              </div>
            </div>
          ))}
        </div>

        {currentUserRank && currentUserRank > 10 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-4 p-3">
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 font-bold">
                {currentUserRank}
              </span>

              <img
                src={
                  profile?.avatar_url ||
                  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face"
                }
                alt="Your rank"
                className="w-10 h-10 rounded-full object-cover"
              />

              <div className="flex-1">
                <h3 className="font-medium">
                  You
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    Your rank
                  </span>
                </h3>
                <p className="text-xs text-gray-400">@{profile?.username}</p>
              </div>

              <div className="text-right">
                <p className="font-semibold">Lvl {profile?.level || 1}</p>
                <p className="text-sm text-gray-400">{profile?.xp || 0} XP</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <Button
            onClick={fetchLeaderboard}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Leaderboard
          </Button>
        </div>
      </div>

      {/* Mood Selection Modal */}
      {showMoodModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">How are you feeling?</h2>
              <button
                onClick={() => setShowMoodModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-300 mb-6">
              Tracking your mood helps understand emotional spending patterns
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {moodOptions.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => logMood(mood.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                    userMood === mood.id
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-white/10 hover:border-white/15 hover:bg-white/5"
                  }`}
                >
                  <span className="text-3xl mb-2">{mood.emoji}</span>
                  <span className="font-medium">{mood.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowMoodModal(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Choose Your Avatar</h2>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b">
              {Object.entries(avatarCategories).map(([key, category]) => (
                <button
                  key={key}
                  onClick={() => setSelectedAvatarCategory(key as AvatarCategoryKey)}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                    selectedAvatarCategory === key
                      ? "bg-yellow text-white border-b-2 border-yellow"
                      : "bg-white/10 text-gray-200 hover:bg-white/15"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Preview Section */}
            {selectedAvatar && (
              <div className="mb-4 p-4 glass-inset">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedAvatar}
                    alt="Selected Avatar Preview"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium">Preview</p>
                    <p className="text-sm text-gray-400">
                      {avatarCategories[selectedAvatarCategory].name} Style
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Avatar Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {avatarCategories[selectedAvatarCategory].avatars.map(
                (avatar, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <img
                      src={avatar}
                      alt={`${
                        avatarCategories[selectedAvatarCategory].name
                      } Avatar ${index + 1}`}
                      className={`w-20 h-20 rounded-full object-cover cursor-pointer border-2 transition-all hover:scale-105 ${
                        selectedAvatar === avatar
                          ? "border-yellow-500 ring-2 ring-yellow-200"
                          : "border-white/10 hover:border-white/15"
                      }`}
                      onClick={() => setSelectedAvatar(avatar)}
                      onError={(e) => {
                        console.error("Failed to load avatar:", avatar);
                        e.currentTarget.src =
                          "https://via.placeholder.com/150x150/cccccc/666666?text=Avatar";
                      }}
                    />
                    <span className="text-xs text-gray-400 mt-1">
                      {avatarCategories[selectedAvatarCategory].name}{" "}
                      {index + 1}
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Selected:{" "}
                {selectedAvatar ? "Avatar chosen" : "No avatar selected"}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowAvatarModal(false);
                    setSelectedAvatar(null);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedAvatar || !profile) return;

                    const { error } = await supabase
                      .from("profiles")
                      .update({ avatar_url: selectedAvatar })
                      .eq("id", profile.id);

                    if (!error) {
                      setProfile(
                        (prev) =>
                          prev && { ...prev, avatar_url: selectedAvatar }
                      );
                      setShowAvatarModal(false);
                      setSelectedAvatar(null);
                    } else {
                      console.error("Error updating avatar:", error);
                    }
                  }}
                  disabled={!selectedAvatar}
                  variant="primary"
                >
                  Save Avatar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

