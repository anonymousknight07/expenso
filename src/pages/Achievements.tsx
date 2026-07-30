import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Trophy,
  Award,
  Crown,
  Flame,
  ShieldCheck,
  Sparkles,
  Target,
  BarChart3,
  Wallet,
  TrendingUp,
  Gift,
  Zap,
  Receipt,
  Lock,
  CheckCircle2,
  Filter,
  RefreshCw,
  HelpCircle,
  X,
  Star,
  ChevronRight,
} from "lucide-react";
import {
  ALL_BADGES,
  Badge,
  evaluateUserAchievements,
  UserProgress,
  syncUserXPAndAchievements,
} from "../lib/achievements";
import { toast } from "react-hot-toast";

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

const TIER_COLORS: Record<
  string,
  { border: string; bg: string; text: string; badgeBg: string }
> = {
  bronze: {
    border: "border-amber-700/30",
    bg: "from-amber-950/20 to-orange-950/20",
    text: "text-amber-400",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  silver: {
    border: "border-slate-400/30",
    bg: "from-slate-900/30 to-slate-800/20",
    text: "text-slate-300",
    badgeBg: "bg-slate-400/20 text-slate-200 border-slate-400/30",
  },
  gold: {
    border: "border-yellow/40",
    bg: "from-yellow/15 via-amber-950/10 to-transparent",
    text: "text-yellow",
    badgeBg: "bg-yellow/20 text-yellow border-yellow/30",
  },
  platinum: {
    border: "border-purple-500/40",
    bg: "from-purple-950/30 via-indigo-950/20 to-transparent",
    text: "text-purple-300",
    badgeBg: "bg-purple-500/20 text-purple-200 border-purple-500/30",
  },
};

const Achievements = () => {
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Record<string, UserProgress>>({});
  const [totalXp, setTotalXp] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [rankTitle, setRankTitle] = useState("Novice Saver");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentMonthName = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const loadData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const result = await syncUserXPAndAchievements(user.id);
    setProgressMap(result.progressMap);
    setTotalXp(result.totalXp);
    setUnlockedCount(result.unlockedCount);
    setLevel(result.level);
    setRankTitle(result.rankTitle);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success("Achievements updated!");
  };

  const nextLevelXp = level * 150;
  const currentLevelBaseXp = (level - 1) * 150;
  const levelProgressXp = totalXp - currentLevelBaseXp;
  const levelXpNeeded = 150;
  const levelPercent = Math.min((levelProgressXp / levelXpNeeded) * 100, 100);

  const filteredBadges = ALL_BADGES.filter((badge) => {
    if (activeCategory === "all") return true;
    return badge.category === activeCategory;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Level & XP Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-yellow/20 bg-gradient-to-r from-yellow/10 via-purple-950/30 to-slate-900/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl mb-8">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-yellow/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-yellow to-amber-500 text-black shadow-lg shadow-yellow/20 tracking-wide uppercase">
                {rankTitle}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-gray-200 border border-white/10 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow" />
                {currentMonthName} Challenges Active
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Achievements & Quest Badges
            </h1>
            <p className="text-gray-300 text-sm max-w-2xl">
              Complete monthly challenges, hit savings milestones, and maintain spending discipline to earn XP and unlock financial trophies.
            </p>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto">
            {/* Level Ring Card */}
            <div className="glass-card p-5 border-white/10 flex-1 lg:flex-initial min-w-[200px] flex items-center gap-4">
              <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow to-amber-600 text-black font-extrabold text-2xl shadow-lg shadow-yellow/30">
                {level}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Current Rank</p>
                <p className="text-lg font-bold text-white">Level {level}</p>
                <p className="text-xs text-yellow font-semibold mt-0.5">
                  {totalXp} Total XP
                </p>
              </div>
            </div>

            {/* Unlocked Badges Counter */}
            <div className="glass-card p-5 border-white/10 flex-1 lg:flex-initial min-w-[170px] text-center">
              <p className="text-xs font-semibold text-gray-400">Unlocked Badges</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">
                {unlockedCount} <span className="text-sm font-normal text-gray-400">/ {ALL_BADGES.length}</span>
              </p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                <div
                  className="bg-yellow h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${(unlockedCount / ALL_BADGES.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 relative z-10">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-300 mb-2">
            <span>Progress to Level {level + 1}</span>
            <span>
              {levelProgressXp} / {levelXpNeeded} XP to Next Level
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/5">
            <div
              className="bg-gradient-to-r from-yellow via-amber-400 to-amber-500 h-full rounded-full transition-all duration-500 shadow-md shadow-yellow/30"
              style={{ width: `${levelPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "All Badges" },
            { id: "monthly", label: `Monthly Special` },
            { id: "milestone", label: "Milestones" },
            { id: "budgeting", label: "Budgeting" },
            { id: "savings", label: "Savings" },
            { id: "tools", label: "Power Tools" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeCategory === tab.id
                  ? "bg-yellow/20 border-yellow text-white shadow-md shadow-yellow/10"
                  : "bg-white/[0.04] border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 rounded-xl font-medium text-xs bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-yellow" : ""}`}
          />
          <span>Re-Evaluate Progress</span>
        </button>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBadges.map((badge) => {
          const progress = progressMap[badge.id] || {
            currentCount: 0,
            targetCount: badge.targetCount,
            unlocked: false,
          };

          const IconComponent = ICON_MAP[badge.iconName] || Trophy;
          const tierStyle = TIER_COLORS[badge.tier] || TIER_COLORS.bronze;
          const percent = Math.min(
            (progress.currentCount / progress.targetCount) * 100,
            100
          );

          return (
            <div
              key={badge.id}
              onClick={() => setSelectedBadge(badge)}
              className={`glass-card p-5 relative group overflow-hidden border ${
                tierStyle.border
              } hover:border-white/30 transition-all duration-300 cursor-pointer ${
                progress.unlocked
                  ? "bg-gradient-to-br " + tierStyle.bg
                  : "opacity-80 bg-white/[0.02]"
              }`}
            >
              {/* Top Row: Tier Pill & XP Badge */}
              <div className="flex justify-between items-center mb-4">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${tierStyle.badgeBg}`}
                >
                  {badge.tier}
                </span>

                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-xs font-bold text-yellow">
                  <Star className="w-3 h-3 fill-yellow" />
                  <span>+{badge.xp} XP</span>
                </div>
              </div>

              {/* Icon & Title */}
              <div className="flex items-start gap-4 mb-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
                    progress.unlocked
                      ? "bg-gradient-to-br from-yellow/30 to-amber-500/20 text-yellow border border-yellow/40"
                      : "bg-white/5 text-gray-500 border border-white/10"
                  }`}
                >
                  {progress.unlocked ? (
                    <IconComponent className="w-6 h-6" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-500" />
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-white text-base tracking-tight group-hover:text-yellow transition-colors">
                    {badge.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                    {badge.description}
                  </p>
                </div>
              </div>

              {/* Progress Bar & Status */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1.5">
                  <span className="font-medium">
                    {progress.unlocked ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Unlocked
                      </span>
                    ) : (
                      <span>Progress</span>
                    )}
                  </span>
                  <span className="font-semibold text-gray-300">
                    {progress.currentCount} / {progress.targetCount}
                  </span>
                </div>

                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progress.unlocked
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : "bg-yellow"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in-out">
          <div className="glass-modal p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                  TIER_COLORS[selectedBadge.tier]?.badgeBg
                }`}
              >
                {selectedBadge.tier} Tier
              </span>
              <button
                onClick={() => setSelectedBadge(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center my-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow/30 to-amber-500/20 border border-yellow/40 flex items-center justify-center mx-auto mb-4 text-yellow shadow-xl shadow-yellow/10">
                {(() => {
                  const Icon = ICON_MAP[selectedBadge.iconName] || Trophy;
                  return <Icon className="w-10 h-10" />;
                })()}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {selectedBadge.title}
              </h2>
              <p className="text-sm text-gray-300 max-w-sm mx-auto">
                {selectedBadge.description}
              </p>
            </div>

            <div className="glass-inset p-4 my-4 space-y-2 border-white/10">
              <div className="flex justify-between text-xs text-gray-300">
                <span>XP Reward:</span>
                <span className="font-bold text-yellow">+{selectedBadge.xp} XP</span>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Category:</span>
                <span className="font-bold text-white capitalize">
                  {selectedBadge.category}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Status:</span>
                <span className="font-bold text-emerald-400">
                  {progressMap[selectedBadge.id]?.unlocked
                    ? "Unlocked 🎉"
                    : "In Progress ⏳"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedBadge(null)}
              className="w-full py-2.5 rounded-xl bg-yellow text-black font-extrabold text-sm hover:bg-yellow-600 transition-colors shadow-lg shadow-yellow/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Achievements;
