import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Loader2, Flame, Sparkles, Maximize2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCurrency } from "../../contexts/CurrencyContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DashboardFinancialData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  recentExpenses: { description: string; amount: number; category: string; date: string }[];
  overBudgets: { category: string; amount: number; spent: number }[];
  goals: { title: string; target_amount: number; current_amount: number }[];
}

const ROAST_PROMPTS = [
  "💀 Savage Roast My Dashboard Data!",
  "🍕 Roast My Food & Delivery Obsession",
  "💥 Roast My Over-Budget Violations",
  "💸 Am I Speedrunning Bankruptcy?",
];

const MENTOR_PROMPTS = [
  "💰 How can I improve my savings rate?",
  "📊 What's the 50/30/20 budget rule?",
  "🎯 Help me plan my financial goals",
  "💡 How to build an emergency fund",
];

const BASIC_QUESTIONS = [
  "What is Expenso?",
  "Who developed Expenso?",
  "What features does Expenso have?",
];

const getRoastSystemPrompt = (sym: string) =>
  `You are Penny, an unsparingly savage, hilarious, and relentless AI Spending Roaster for Expenso created by Akshat. Your job is to analyze the user's REAL dashboard data (income, expenses, net deficit/surplus, category budgets, food delivery habits, and lagging goals) and roast them with brutal, sarcastic humor. ALWAYS use the user's current currency symbol (${sym}) for all financial amounts. If formatting tables, use standard markdown table syntax (which will render as clean tables). Use emojis (🍕💸🛍️💀), hyperbole, and punchy jokes. Do not hold back on impulse purchases, blown budget limits, or negative balances!`;

const getMentorSystemPrompt = (sym: string) =>
  `You are Penny, a friendly, encouraging, and empowering AI Financial Mentor for Expenso created by Akshat. Focus on positive financial advice, budgeting tips, savings strategies, and app guidance in a warm, inspiring tone. ALWAYS use the user's current currency symbol (${sym}) for all monetary amounts.`;

import { getPayCycleRange, PayCycleType } from "../../utils/dateUtils";

const fetchRealDashboardData = async (
  userId: string,
  payCycleType: PayCycleType = 'calendar',
  salaryDay: number = 28
): Promise<DashboardFinancialData> => {
  const cycleRange = getPayCycleRange(null, payCycleType, salaryDay);
  const startStr = cycleRange.startDateStr;
  const endStr = cycleRange.endDateStr;

  // 1. Income total in this cycle
  const { data: incomeData } = await supabase
    .from("income")
    .select("amount, in_hand_amount, date")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr);

  const totalIncome = (incomeData || []).reduce(
    (sum, i) => sum + Number(i.in_hand_amount || i.amount || 0),
    0
  );

  // 2. Expenses in this cycle with category mappings
  const { data: expenseData } = await supabase
    .from("expenses")
    .select(`
      amount,
      description,
      date,
      expense_category_mappings (
        expense_categories (
          name,
          color
        )
      )
    `)
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date", { ascending: false });

  const formattedExpenses = (expenseData || []).map((e: any) => {
    const mapping = Array.isArray(e.expense_category_mappings)
      ? e.expense_category_mappings[0]
      : e.expense_category_mappings;
    const cat = Array.isArray(mapping?.expense_categories)
      ? mapping.expense_categories[0]
      : mapping?.expense_categories;
    return {
      description: e.description || "Expense",
      amount: Number(e.amount || 0),
      category: cat?.name || "Uncategorized",
      date: e.date,
    };
  });

  const totalExpenses = formattedExpenses.reduce(
    (sum, e) => sum + e.amount,
    0
  );
  const recentExpenses = formattedExpenses.slice(0, 10);

  // Calculate spent per category
  const categorySpentMap: Record<string, number> = {};
  formattedExpenses.forEach((exp) => {
    categorySpentMap[exp.category] = (categorySpentMap[exp.category] || 0) + exp.amount;
  });

  // 3. Category Budgets & Over-budget check
  const { data: budgetData } = await supabase
    .from("budgets")
    .select(`
      amount,
      category:expense_categories (
        name
      )
    `)
    .eq("user_id", userId);

  const overBudgets = (budgetData || [])
    .map((b: any) => {
      const catObj = Array.isArray(b.category) ? b.category[0] : b.category;
      const categoryName = catObj?.name || "Uncategorized";
      const budgetAmount = Number(b.amount || 0);
      const spent = categorySpentMap[categoryName] || 0;
      return {
        category: categoryName,
        amount: budgetAmount,
        spent,
      };
    })
    .filter((b) => b.spent > b.amount);

  // 4. Goals
  const { data: goalsData } = await supabase
    .from("goals")
    .select("title, target_amount, current_amount")
    .eq("user_id", userId);

  const balance = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  return {
    totalIncome,
    totalExpenses,
    balance,
    savingsRate,
    recentExpenses,
    overBudgets,
    goals: (goalsData || []).map((g) => ({
      title: g.title,
      target_amount: Number(g.target_amount || 0),
      current_amount: Number(g.current_amount || 0),
    })),
  };
};

const generateSavageRoast = (data: DashboardFinancialData, sym: string): string => {
  const { totalIncome, totalExpenses, balance, savingsRate, recentExpenses, overBudgets, goals } = data;

  if (totalIncome === 0 && totalExpenses === 0 && recentExpenses.length === 0) {
    return `💀 **SAVAGE ROAST**: You have ${sym}0 income and ${sym}0 expenses logged... Either you're living off-grid like a 17th-century monk, or you're hiding your secret shopping receipts from me! Log some real spending so I can destroy your impulse habits! 🕵️‍♂️💸`;
  }

  let roastParts: string[] = [];

  roastParts.push(`🔥 **SAVAGE REALITY CHECK** (Live Dashboard Figures in ${sym}):\n`);

  // 1. Balance & Deficit Roast
  if (balance < 0) {
    roastParts.push(
      `🚨 **Net Deficit Disaster**: You've earned **${sym}${totalIncome.toLocaleString()}** this month but blew **${sym}${totalExpenses.toLocaleString()}**! That's a **-${sym}${Math.abs(
        balance
      ).toLocaleString()} NET DEFICIT**! You are literally burning money faster than a SpaceX rocket launch! Are you funding a small nation's military or just speedrunning bankruptcy? 💸💀`
    );
  } else if (totalIncome > 0) {
    roastParts.push(
      `📊 **Monthly Summary**: Income **${sym}${totalIncome.toLocaleString()}** vs Expenses **${sym}${totalExpenses.toLocaleString()}** (Net Surplus: **+${sym}${balance.toLocaleString()}**). Savings Rate: **${savingsRate}%**.`
    );
    if (savingsRate < 15) {
      roastParts.push(
        `📉 A **${savingsRate}% savings rate** isn't a financial strategy... that's financial chicken! At this pace, your retirement plan is literally buying scratch-off lottery tickets! 🎟️😭`
      );
    }
  } else {
    roastParts.push(
      `💸 Total Monthly Expenses: **${sym}${totalExpenses.toLocaleString()}** logged with **${sym}0 recorded income**! Bold move treating your bank account like an infinite money glitch! 🎮🕹️`
    );
  }

  // 2. Over-budget Violations
  if (overBudgets.length > 0) {
    const ob = overBudgets[0];
    const diff = ob.spent - ob.amount;
    roastParts.push(
      `💥 **Budget Obliteration**: You've completely annihilated your **"${ob.category}"** budget! Limit was **${sym}${ob.amount}**, but you spent **${sym}${ob.spent}** (Over limit by **+${sym}${diff}**)! Budget limits are supposed to be guardrails, not targets to smash through at 100 mph! 🚗💨`
    );
  }

  // 3. Category Breakdown (Food & Shopping)
  const foodCount = recentExpenses.filter((e) => {
    const text = `${e.category || ""} ${e.description || ""}`.toLowerCase();
    return (
      text.includes("food") ||
      text.includes("pizza") ||
      text.includes("zomato") ||
      text.includes("swiggy") ||
      text.includes("uber") ||
      text.includes("dining") ||
      text.includes("restaurant") ||
      text.includes("cafe")
    );
  }).length;

  const foodTotal = recentExpenses
    .filter((e) => {
      const text = `${e.category || ""} ${e.description || ""}`.toLowerCase();
      return (
        text.includes("food") ||
        text.includes("pizza") ||
        text.includes("zomato") ||
        text.includes("swiggy") ||
        text.includes("uber") ||
        text.includes("dining") ||
        text.includes("restaurant") ||
        text.includes("cafe")
      );
    })
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  if (foodCount > 0) {
    roastParts.push(
      `🍕 **Food Delivery Obsession**: You've logged **${foodCount} food/dining orders** totalling **${sym}${foodTotal}** in recent spending! DoorDash executives are naming a conference room after you right now! Cook a meal or your stove will file a missing person report! 🍳🔥`
    );
  }

  // 4. Goals Roast
  if (goals.length > 0) {
    const g = goals[0];
    const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
    if (pct < 30) {
      roastParts.push(
        `🎯 **Goal Lag**: Your savings goal *"${g.title}"* is currently sitting at **${pct}% funded** (${sym}${g.current_amount} / ${sym}${g.target_amount}). At this velocity, you will reach your goal in the year 2089! Hope your future self enjoys vintage wheelchairs! ♿👴`
      );
    }
  }

  roastParts.push(`\n*Want gentle mercy? Toggle to Encouragement Mentor Mode in the top right header! 👼*`);

  return roastParts.join("\n\n");
};

const ChatBot = () => {
  const { currency, payCycleType, salaryDay } = useCurrency();
  const currSym = currency.symbol || "$";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [personalityMode, setPersonalityMode] = useState<"roast" | "mentor">("roast");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(ROAST_PROMPTS);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (error) {
          setIsLoggedIn(false);
        } else {
          setIsLoggedIn(!!user);
        }
        setSuggestedQuestions(
          user
            ? personalityMode === "roast"
              ? ROAST_PROMPTS
              : MENTOR_PROMPTS
            : BASIC_QUESTIONS
        );
      } catch (error) {
        setIsLoggedIn(false);
        setSuggestedQuestions(BASIC_QUESTIONS);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      setIsLoggedIn(!!user);
      setSuggestedQuestions(
        user
          ? personalityMode === "roast"
            ? ROAST_PROMPTS
            : MENTOR_PROMPTS
          : BASIC_QUESTIONS
      );

      if (event === "SIGNED_OUT") {
        setMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [personalityMode]);

  const handleBasicQuestion = (question: string): string => {
    const lowerQuestion = question.toLowerCase();

    if (
      lowerQuestion.includes("what is expenso") ||
      lowerQuestion.includes("about expenso")
    ) {
      return "Expenso is a comprehensive expense tracking and financial management application that helps users monitor their spending, create budgets, and achieve their financial goals with gamified RPG elements and savage AI coaching.";
    }

    if (
      lowerQuestion.includes("who developed") ||
      lowerQuestion.includes("developer") ||
      lowerQuestion.includes("created")
    ) {
      return "Expenso was developed by Akshat. I'm Penny, your savage AI financial roaster, also created by Akshat to destroy your impulse spending habits!";
    }

    if (
      lowerQuestion.includes("features") ||
      lowerQuestion.includes("what can") ||
      lowerQuestion.includes("functionality")
    ) {
      return "Expenso features include: Expense tracking, Budget management, Financial RPG Shop (avatar frames & themes), No-Spend Streaks with Daily Fortune Wheel, Financial Time Machine simulator, and this Savage AI Roast Coach!";
    }

    return "Please log in to unlock the Savage Roast My Dashboard AI Coach and transaction analysis!";
  };

  const handleSubmit = async (e: React.FormEvent, customQuestion?: string) => {
    e.preventDefault();
    const userMessage = customQuestion || input.trim();
    if (!userMessage) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      if (!isLoggedIn) {
        const response = handleBasicQuestion(userMessage);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response },
        ]);
        setSuggestedQuestions(BASIC_QUESTIONS);
        setIsLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      let dashboardData: DashboardFinancialData | null = null;
      let dashboardContextString = "";

      if (session?.user) {
        dashboardData = await fetchRealDashboardData(session.user.id, payCycleType, salaryDay);
        dashboardContextString = `\n\nUser Live Financial Dashboard Context (Currency Symbol: ${currSym}):
- Monthly Income: ${currSym}${dashboardData.totalIncome}
- Monthly Expenses: ${currSym}${dashboardData.totalExpenses}
- Net Balance: ${currSym}${dashboardData.balance}
- Savings Rate: ${dashboardData.savingsRate}%
- Over-Budget Categories: ${JSON.stringify(dashboardData.overBudgets)}
- Recent Expenses: ${JSON.stringify(dashboardData.recentExpenses)}
- Financial Goals: ${JSON.stringify(dashboardData.goals)}`;
      }

      const currentSystemPrompt =
        personalityMode === "roast"
          ? getRoastSystemPrompt(currSym)
          : getMentorSystemPrompt(currSym);

      let botResponse = "";

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              messages: [
                ...messages,
                {
                  role: "user",
                  content: userMessage + dashboardContextString,
                },
              ],
              systemPrompt: currentSystemPrompt,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          botResponse = data.choices?.[0]?.message?.content || "";
        }
      } catch (err) {
        console.error("Chat API error:", err);
      }

      // Fallback local roast generator using real dashboard data and active currency
      if (!botResponse && dashboardData) {
        if (personalityMode === "roast") {
          botResponse = generateSavageRoast(dashboardData, currSym);
        } else {
          botResponse = `💡 **Financial Summary**: You've earned **${currSym}${dashboardData.totalIncome}** and spent **${currSym}${dashboardData.totalExpenses}** this month. Your current savings rate is **${dashboardData.savingsRate}%**. Keep staying disciplined!`;
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: botResponse || "Sorry, I couldn't process that request." },
      ]);

      setSuggestedQuestions(
        personalityMode === "roast" ? ROAST_PROMPTS : MENTOR_PROMPTS
      );
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-yellow text-white p-3 rounded-full shadow-lg">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50">
      {isOpen ? (
        <div className="bg-[#16171d] flex flex-col h-[100vh] w-full sm:h-[540px] sm:w-[420px] sm:rounded-2xl sm:shadow-2xl border border-white/10 overflow-hidden resize min-w-[320px] min-h-[380px] max-w-[95vw] max-h-[90vh]">
          {/* Header */}
          <div className="p-3 sm:p-4 bg-gradient-to-r from-[#ff3c02] to-[#fa7041] flex items-center justify-between gap-2 shadow-md flex-shrink-0">
            <div className="flex items-center gap-2">
              <img
                src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
                alt="AI Assistant"
                className="w-9 h-9 rounded-full object-cover border-2 border-white/30 shadow-md"
              />
              <div>
                <h3 className="font-extrabold text-white text-sm">
                  Penny {personalityMode === "roast" ? "💀🔥" : "👼"}
                </h3>
                <p className="text-[11px] text-white/80">
                  {personalityMode === "roast" ? `Savage Roaster (${currSym})` : `Financial Mentor (${currSym})`}
                </p>
              </div>
            </div>

            {/* Personality Toggle & Close */}
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <button
                  onClick={() =>
                    setPersonalityMode(personalityMode === "roast" ? "mentor" : "roast")
                  }
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border transition-all flex items-center gap-1 shadow-sm ${
                    personalityMode === "roast"
                      ? "bg-black/30 text-yellow border-yellow/40 hover:bg-black/50"
                      : "bg-white/20 text-white border-white/40 hover:bg-white/30"
                  }`}
                  title="Toggle AI Coach Personality"
                >
                  {personalityMode === "roast" ? (
                    <>
                      <Flame className="w-3 h-3 text-yellow" /> Savage Roast
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-white" /> Mentor
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 py-4 sm:py-6">
                <img
                  src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
                  alt="Welcome"
                  className="w-14 h-14 mx-auto mb-3 rounded-full border-2 border-yellow shadow-lg"
                />
                <p className="font-extrabold text-white text-base">
                  Hi! I'm Penny 👋
                </p>
                <p className="text-xs text-gray-300 mt-1 max-w-[300px] mx-auto">
                  {personalityMode === "roast"
                    ? `Connected to your real Dashboard data in ${currSym}! Ready for a savage, unsparing roast? 💀🔥`
                    : `Ready to guide you towards positive financial growth in ${currSym}! 👼`}
                </p>

                {isLoggedIn ? (
                  <div className="mt-4 space-y-2">
                    {suggestedQuestions.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={(e) => handleSubmit(e, prompt)}
                        className={`w-full p-2.5 text-left rounded-xl transition-all text-xs font-bold border flex items-center justify-between ${
                          personalityMode === "roast"
                            ? "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                            : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                        }`}
                      >
                        <span>{prompt}</span>
                        <Send className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-yellow font-semibold mb-2">
                      Log in to unlock Savage Dashboard AI Roasts!
                    </p>
                    {BASIC_QUESTIONS.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={(e) => handleSubmit(e, prompt)}
                        className="w-full p-2 text-left hover:bg-white/10 rounded-lg transition-colors text-xs text-gray-300"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } items-end gap-2`}
              >
                {message.role === "assistant" && (
                  <img
                    src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
                    alt="Assistant"
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0 self-start mt-1"
                  />
                )}
                <div
                  className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-[#ff3c02] to-[#fa7041] text-white shadow-md"
                      : "bg-white/10 text-white border border-white/10 shadow-md"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-3 rounded-xl border border-white/20 bg-black/40 shadow-inner">
                          <table className="w-full text-left border-collapse text-[11px]" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-yellow/20 text-yellow font-extrabold uppercase text-[10px] tracking-wider" {...props} />
                      ),
                      tbody: ({ node, ...props }) => <tbody className="divide-y divide-white/10" {...props} />,
                      tr: ({ node, ...props }) => <tr className="hover:bg-white/5 transition-colors" {...props} />,
                      th: ({ node, ...props }) => <th className="p-2 border-b border-white/20 font-bold" {...props} />,
                      td: ({ node, ...props }) => <td className="p-2 border-b border-white/10 text-gray-200" {...props} />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.role === "user" && (
                  <img
                    src="https://cdn.sanity.io/images/rh8hx4sn/production/66378e3886cbbfa29ae7eaea174bb98cf9fceaf7-1024x1024.png"
                    alt="User"
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0 self-start mt-1"
                  />
                )}
              </div>
            ))}

            {messages.length > 0 && !isLoading && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-gray-400 mb-1.5">
                  Suggested Prompts:
                </p>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={(e) => handleSubmit(e, question)}
                      className="w-full p-2 text-left bg-white/[0.04] hover:bg-white/10 rounded-xl transition-colors text-xs text-gray-300 border border-white/5 flex items-center justify-between"
                    >
                      <span>{question}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start items-end gap-2">
                <img
                  src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
                  alt="Assistant"
                  className="w-6 h-6 rounded-full object-cover"
                />
                <div className="bg-white/10 rounded-xl p-3 flex items-center gap-2 text-xs text-yellow">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching live dashboard figures in {currSym} & roasting...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-white/10 bg-black/20 flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={
                  isLoggedIn
                    ? personalityMode === "roast"
                      ? `Ask to roast your balance, food, or budgets in ${currSym}...`
                      : `Ask Penny for financial guidance in ${currSym}...`
                    : "Ask about Expenso..."
                }
                className="flex-1 px-3 py-2 border border-white/10 bg-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow/50"
              />
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-gradient-to-r from-[#ff3c02] to-[#fa7041] text-white px-3.5 py-2 rounded-xl hover:brightness-110 disabled:opacity-50 transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-[#ff3c02] to-[#fa7041] text-white p-3.5 rounded-full shadow-2xl hover:brightness-110 transition-all relative group border border-white/20"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow text-[10px] font-extrabold text-black border border-white animate-pulse">
            💀
          </span>
        </button>
      )}
    </div>
  );
};

export default ChatBot;
