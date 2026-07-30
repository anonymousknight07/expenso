import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  Flame,
  Calendar,
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  RotateCw,
  Coins,
  ShieldCheck,
  Gift,
  HelpCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface WheelSlice {
  label: string;
  type: "coins" | "xp" | "bonus";
  value: number;
  color: string;
}

const WHEEL_SLICES: WheelSlice[] = [
  { label: "+50 Coins 🪙", type: "coins", value: 50, color: "#f59e0b" },
  { label: "+100 XP ⚡", type: "xp", value: 100, color: "#8b5cf6" },
  { label: "+100 Coins 🪙", type: "coins", value: 100, color: "#10b981" },
  { label: "+200 XP 🚀", type: "xp", value: 200, color: "#ec4899" },
  { label: "+25 Coins 🪙", type: "coins", value: 25, color: "#3b82f6" },
  { label: "JACKPOT +300 👑", type: "coins", value: 300, color: "#ef4444" },
];

const NoSpendTracker = () => {
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [noSpendDays, setNoSpendDays] = useState<string[]>([]);
  const [userCoins, setUserCoins] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Wheel state
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegree, setRotationDegree] = useState(0);
  const [hasSpunToday, setHasSpunToday] = useState(false);
  const [wonPrize, setWonPrize] = useState<WheelSlice | null>(null);

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const todayStr = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // Fetch user expenses for current month
    const { data: expenses } = await supabase
      .from("expenses")
      .select("date")
      .eq("user_id", user.id);

    const expenseDates = new Set((expenses || []).map((e) => e.date.slice(0, 10)));

    // Generate days of month up to today
    const daysInMonth = new Date().getDate(); // day of month 1..31
    const markedNoSpend: string[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayNum = d < 10 ? `0${d}` : `${d}`;
      const dateStr = `${currentMonthStr}-${dayNum}`;
      if (!expenseDates.has(dateStr)) {
        markedNoSpend.push(dateStr);
      }
    }

    setNoSpendDays(markedNoSpend);

    // Calculate streak
    let streak = 0;
    for (let d = daysInMonth; d >= 1; d--) {
      const dayNum = d < 10 ? `0${d}` : `${d}`;
      const dateStr = `${currentMonthStr}-${dayNum}`;
      if (markedNoSpend.includes(dateStr)) {
        streak++;
      } else {
        break;
      }
    }
    setCurrentStreak(streak);

    // Load local storage shop state & spin state
    try {
      const shopKey = `expenso_shop_${user.id}`;
      const savedShop = localStorage.getItem(shopKey);
      if (savedShop) {
        const parsed = JSON.parse(savedShop);
        setUserCoins(parsed.coins || 0);
      }

      const spinKey = `expenso_spin_${user.id}`;
      const savedSpin = localStorage.getItem(spinKey);
      if (savedSpin) {
        const parsedSpin = JSON.parse(savedSpin);
        if (parsedSpin.lastSpinDate === todayStr) {
          setHasSpunToday(true);
        }
        setBestStreak(Math.max(parsedSpin.bestStreak || 0, streak));
      } else {
        setBestStreak(streak);
      }
    } catch (e) {
      console.error("Storage load error:", e);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const spinWheel = () => {
    if (isSpinning) return;
    if (hasSpunToday) {
      toast.error("You have already spun the wheel today! Come back tomorrow.");
      return;
    }

    setIsSpinning(true);
    setWonPrize(null);

    // Random slice index (0..5)
    const randomIndex = Math.floor(Math.random() * WHEEL_SLICES.length);
    const sliceAngle = 360 / WHEEL_SLICES.length;
    // Calculate degree to stop at target slice (5 full spins + slice offset)
    const targetDegree = 360 * 5 + (360 - randomIndex * sliceAngle - sliceAngle / 2);

    setRotationDegree(targetDegree);

    setTimeout(async () => {
      setIsSpinning(false);
      const prize = WHEEL_SLICES[randomIndex];
      setWonPrize(prize);
      setHasSpunToday(true);

      // Award prize
      if (userId) {
        // Save spin date
        const spinKey = `expenso_spin_${userId}`;
        localStorage.setItem(
          spinKey,
          JSON.stringify({
            lastSpinDate: todayStr,
            bestStreak: Math.max(bestStreak, currentStreak),
          })
        );

        // If prize is coins, update coins
        if (prize.type === "coins") {
          const shopKey = `expenso_shop_${userId}`;
          const savedShop = localStorage.getItem(shopKey);
          const parsed = savedShop ? JSON.parse(savedShop) : {};
          const newCoins = (parsed.coins || 0) + prize.value;
          parsed.coins = newCoins;
          localStorage.setItem(shopKey, JSON.stringify(parsed));
          setUserCoins(newCoins);
          toast.success(`🎉 You won ${prize.label}!`);
        } else if (prize.type === "xp") {
          // Add XP to profiles table
          const { data: profile } = await supabase
            .from("profiles")
            .select("xp, level")
            .eq("id", userId)
            .maybeSingle();

          const newXp = (profile?.xp || 0) + prize.value;
          const newLevel = Math.floor(newXp / 150) + 1;

          await supabase
            .from("profiles")
            .update({ xp: newXp, level: newLevel })
            .eq("id", userId);

          toast.success(`⚡ You earned ${prize.label}!`);
        }
      }
    }, 4000);
  };

  // Render Calendar Grid
  const renderCalendar = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="grid grid-cols-7 gap-2 sm:gap-3 my-4 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
          <div key={dayName} className="text-xs font-bold text-gray-400 py-1">
            {dayName}
          </div>
        ))}

        {daysArray.map((d) => {
          const dayNum = d < 10 ? `0${d}` : `${d}`;
          const dateStr = `${currentMonthStr}-${dayNum}`;
          const isNoSpend = noSpendDays.includes(dateStr);
          const isToday = dateStr === todayStr;

          return (
            <div
              key={d}
              className={`p-2.5 sm:p-3.5 rounded-2xl border text-xs font-bold transition-all relative ${
                isNoSpend
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/10"
                  : "bg-white/[0.03] border-white/10 text-gray-400"
              } ${isToday ? "ring-2 ring-yellow" : ""}`}
            >
              <span>{d}</span>
              {isNoSpend && (
                <Flame className="w-3.5 h-3.5 text-emerald-400 mx-auto mt-1 animate-bounce" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-slate-900/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl mb-8">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-lg">
                Habit Builder 🔥
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-emerald-300 border border-white/10 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                {currentStreak} Day Active Streak
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              No-Spend Day Streaks & Wheel
            </h1>
            <p className="text-gray-300 text-sm max-w-xl mt-1">
              Maintain financial discipline! Days with zero unnecessary expenses build your streak flame. Spin the Daily Fortune Wheel for bonus coins and XP boosts!
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="glass-card p-4 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 flex-1 md:flex-initial min-w-[170px]">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black font-extrabold text-xl shadow-lg">
                🔥
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Current Streak</p>
                <p className="text-2xl font-extrabold text-white">{currentStreak} Days</p>
              </div>
            </div>

            <div className="glass-card p-4 border-white/10 flex items-center gap-3 flex-1 md:flex-initial min-w-[170px]">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-yellow font-extrabold text-xl">
                🏆
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Best Streak</p>
                <p className="text-2xl font-extrabold text-white">{bestStreak} Days</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Calendar Streak Grid */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                This Month's No-Spend Log
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Days highlighted in green had 0 logged expenses.
              </p>
            </div>

            <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              {noSpendDays.length} Days Saved
            </div>
          </div>

          {renderCalendar()}

          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap justify-between items-center text-xs text-gray-300 gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-400" />
              <span>No-Spend Day Logged</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white/10 border border-white/20" />
              <span>Expense Logged</span>
            </div>
          </div>
        </div>

        {/* Right Column: Daily Fortune Spin Wheel */}
        <div className="glass-card p-6 text-center flex flex-col justify-between border-yellow/20">
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-yellow" />
              <h2 className="text-xl font-bold text-white">Daily Fortune Wheel</h2>
            </div>
            <p className="text-xs text-gray-300 mb-6">
              Spin once every 24 hours to win Expenso Coins and XP boosts!
            </p>

            {/* Wheel Canvas / SVG */}
            <div className="relative w-64 h-64 mx-auto my-4 flex items-center justify-center">
              {/* Pointer Indicator */}
              <div className="absolute -top-3 z-30 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-yellow drop-shadow-md" />

              {/* Rotating Wheel */}
              <div
                className="w-full h-full rounded-full border-4 border-yellow/50 shadow-2xl relative overflow-hidden transition-all duration-[4000ms] ease-out"
                style={{
                  transform: `rotate(${rotationDegree}deg)`,
                }}
              >
                {WHEEL_SLICES.map((slice, idx) => {
                  const angle = 360 / WHEEL_SLICES.length;
                  const rotateAngle = idx * angle;

                  return (
                    <div
                      key={idx}
                      className="absolute inset-0 origin-center flex items-start justify-center pt-3 font-extrabold text-[11px] text-white shadow-inner"
                      style={{
                        transform: `rotate(${rotateAngle}deg)`,
                        backgroundColor: slice.color,
                        clipPath: "polygon(50% 50%, 0 0, 100% 0)",
                      }}
                    >
                      <span className="mt-2 drop-shadow-md tracking-wider">
                        {slice.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Center Cap */}
              <div className="absolute z-20 w-12 h-12 rounded-full bg-gradient-to-br from-yellow to-amber-500 border-2 border-white shadow-xl flex items-center justify-center font-extrabold text-black text-sm">
                🎯
              </div>
            </div>

            {wonPrize && (
              <div className="my-4 p-3 rounded-2xl bg-yellow/20 border border-yellow text-yellow font-extrabold text-sm animate-pulse">
                🎉 Won: {wonPrize.label}!
              </div>
            )}
          </div>

          <button
            onClick={spinWheel}
            disabled={isSpinning || hasSpunToday}
            className={`w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-xl ${
              hasSpunToday
                ? "bg-white/10 text-gray-500 cursor-not-allowed border border-white/10"
                : "bg-gradient-to-r from-yellow to-amber-500 text-black hover:brightness-110 shadow-yellow/20"
            }`}
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? "animate-spin" : ""}`} />
            <span>
              {isSpinning
                ? "Spinning..."
                : hasSpunToday
                ? "Spun Today ✓"
                : "Spin Fortunes Wheel 🎯"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoSpendTracker;
