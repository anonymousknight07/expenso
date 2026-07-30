import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  TrendingUp,
  Sparkles,
  Rocket,
  Compass,
  DollarSign,
  Palmtree,
  Car,
  Home,
  Crown,
  CheckCircle2,
  Lock,
  Zap,
} from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  cost: number;
  icon: any;
  color: string;
  description: string;
}

const MILESTONES: Milestone[] = [
  {
    id: "bali",
    title: "Trip to Bali 🌴",
    cost: 1500,
    icon: Palmtree,
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30",
    description: "7 days of tropical relaxation funded completely by monthly cuts.",
  },
  {
    id: "car",
    title: "First Car Deposit 🚗",
    cost: 5000,
    icon: Car,
    color: "from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30",
    description: "Solid downpayment for your dream personal vehicle.",
  },
  {
    id: "house",
    title: "House Downpayment 🏠",
    cost: 25000,
    icon: Home,
    color: "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30",
    description: "Key deposit to secure your real estate property.",
  },
  {
    id: "freedom",
    title: "Financial Freedom Vault 👑",
    cost: 100000,
    icon: Crown,
    color: "from-yellow/20 to-amber-500/20 text-yellow border-yellow/30",
    description: "True independence! Living off compound investment yields.",
  },
];

const FinancialTimeMachine = () => {
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(true);

  // Inputs
  const [monthlyIncome, setMonthlyIncome] = useState(3000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(1800);
  const [expenseCutPercent, setExpenseCutPercent] = useState(15);
  const [returnRate, setReturnRate] = useState(8);
  const [years, setYears] = useState(5);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

        // Income
        const { data: incomeData } = await supabase
          .from("income")
          .select("amount, in_hand_amount")
          .eq("user_id", user.id)
          .gte("date", startOfMonth);

        const inc = (incomeData || []).reduce(
          (sum, i) => sum + Number(i.in_hand_amount || i.amount || 0),
          0
        );

        // Expenses
        const { data: expenseData } = await supabase
          .from("expenses")
          .select("amount")
          .eq("user_id", user.id)
          .gte("date", startOfMonth);

        const exp = (expenseData || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

        if (inc > 0) setMonthlyIncome(inc);
        if (exp > 0) setMonthlyExpenses(exp);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // Calculation math
  const monthlySavingsBase = Math.max(0, monthlyIncome - monthlyExpenses);
  const cutAmount = Math.round(monthlyExpenses * (expenseCutPercent / 100));
  const totalMonthlyInvested = monthlySavingsBase + cutAmount;

  // Compound interest calculation
  const months = years * 12;
  const monthlyRate = returnRate / 100 / 12;

  let futureValue = 0;
  if (monthlyRate > 0) {
    futureValue =
      totalMonthlyInvested *
      ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
      (1 + monthlyRate);
  } else {
    futureValue = totalMonthlyInvested * months;
  }

  const totalPrincipal = totalMonthlyInvested * months;
  const totalInterestEarned = Math.max(0, futureValue - totalPrincipal);

  // Calculate month milestone reached
  const getMilestoneTimeline = (cost: number) => {
    if (totalMonthlyInvested <= 0) return "Never";
    let m = 0;
    let val = 0;
    while (val < cost && m < 600) {
      // 50 years max
      m++;
      if (monthlyRate > 0) {
        val =
          totalMonthlyInvested *
          ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate) *
          (1 + monthlyRate);
      } else {
        val = totalMonthlyInvested * m;
      }
    }

    if (m <= months) {
      if (m < 12) return `Unlocked in ${m} months!`;
      const y = (m / 12).toFixed(1);
      return `Unlocked in ~${y} years!`;
    } else {
      const y = (m / 12).toFixed(1);
      return `Projected in ${y} years`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-900/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl mb-8">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-purple-400 to-indigo-500 text-white shadow-lg">
                Financial Time Machine 🔮
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-purple-300 border border-white/10 flex items-center gap-1">
                <Rocket className="w-3.5 h-3.5 text-purple-400" />
                Compounding Wealth Engine
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Future Wealth Simulator
            </h1>
            <p className="text-gray-300 text-sm max-w-xl mt-1">
              Adjust expense cuts and return rates to see how small daily habits compound into life-changing wealth over time.
            </p>
          </div>

          {/* Forecast Box */}
          <div className="glass-card p-5 border-purple-500/30 bg-purple-500/10 min-w-[240px]">
            <p className="text-xs font-semibold text-gray-400">Projected Net Wealth ({years}Y)</p>
            <p className="text-3xl font-extrabold text-yellow mt-1">
              {currency.symbol}
              {Math.round(futureValue).toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-400 font-semibold mt-1">
              + {currency.symbol}
              {Math.round(totalInterestEarned).toLocaleString()} in compound interest!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Sliders & Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Controls Card */}
          <div className="glass-card p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-yellow" />
              Time Machine Variables
            </h2>

            {/* Slider 1: Monthly Income */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Monthly Income</span>
                <span className="text-yellow">
                  {currency.symbol}
                  {monthlyIncome.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="20000"
                step="250"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                className="w-full accent-yellow bg-white/10 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider 2: Monthly Expenses */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Monthly Expenses</span>
                <span className="text-red-400">
                  {currency.symbol}
                  {monthlyExpenses.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="15000"
                step="200"
                value={monthlyExpenses}
                onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                className="w-full accent-red-500 bg-white/10 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider 3: Expense Cut % */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Cut Non-Essential Spending</span>
                <span className="text-emerald-400 font-extrabold">
                  {expenseCutPercent}% ({currency.symbol}
                  {cutAmount}/mo saved)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={expenseCutPercent}
                onChange={(e) => setExpenseCutPercent(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-white/10 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider 4: Return Rate % */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Annual Return Rate</span>
                <span className="text-purple-400 font-extrabold">{returnRate}% / year</span>
              </div>
              <input
                type="range"
                min="1"
                max="18"
                step="1"
                value={returnRate}
                onChange={(e) => setReturnRate(Number(e.target.value))}
                className="w-full accent-purple-500 bg-white/10 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider 5: Time Horizon */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Time Horizon</span>
                <span className="text-white font-extrabold">{years} Years</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-yellow bg-white/10 h-2 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Breakdown Stats Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5 border-white/10 text-center">
              <p className="text-xs text-gray-400 font-semibold">Monthly Investment</p>
              <p className="text-2xl font-extrabold text-white mt-1">
                {currency.symbol}
                {totalMonthlyInvested.toLocaleString()}
              </p>
            </div>

            <div className="glass-card p-5 border-white/10 text-center">
              <p className="text-xs text-gray-400 font-semibold">Total Direct Contribution</p>
              <p className="text-2xl font-extrabold text-gray-300 mt-1">
                {currency.symbol}
                {Math.round(totalPrincipal).toLocaleString()}
              </p>
            </div>

            <div className="glass-card p-5 border-emerald-500/30 bg-emerald-500/10 text-center">
              <p className="text-xs text-emerald-300 font-semibold">Compound Growth</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                {currency.symbol}
                {Math.round(totalInterestEarned).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Unlocked Milestones Timeline */}
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-yellow" />
            <h2 className="text-xl font-bold text-white">Unlocked Milestones</h2>
          </div>
          <p className="text-xs text-gray-400">
            See when your projected savings unlock real life-changing milestones:
          </p>

          <div className="space-y-4 my-4">
            {MILESTONES.map((m) => {
              const Icon = m.icon;
              const isUnlocked = futureValue >= m.cost;
              const timelineText = getMilestoneTimeline(m.cost);

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isUnlocked
                      ? "bg-gradient-to-r " + m.color + " shadow-md"
                      : "bg-white/[0.02] border-white/10 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isUnlocked ? "bg-white/10" : "bg-white/5 text-gray-500"
                      }`}
                    >
                      {isUnlocked ? (
                        <Icon className="w-5 h-5" />
                      ) : (
                        <Lock className="w-4 h-4 text-gray-500" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-white text-sm">{m.title}</h3>
                        <span className="text-xs font-extrabold text-yellow">
                          {currency.symbol}
                          {m.cost.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 mt-0.5 line-clamp-2">
                        {m.description}
                      </p>

                      <div className="mt-2 text-[11px] font-semibold flex items-center gap-1">
                        {isUnlocked ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {timelineText}
                          </span>
                        ) : (
                          <span className="text-yellow">{timelineText}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialTimeMachine;
