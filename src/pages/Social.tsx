import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  Users,
  Trophy,
  Plus,
  Star,
  Target,
  Crown,
  Lightbulb,
  Clock,
  CheckCircle,
  Zap,
  TrendingUp,
  PiggyBank,
  Gamepad2,
  Copy,
  UserPlus,
  RefreshCw,
  IndianRupee,
} from "lucide-react";
import Button from "../components/common/Button";
import { toast } from "react-hot-toast";

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: "savings" | "spending_limit" | "streak" | "custom";
  target_amount?: number;
  duration_days: number;
  xp_reward: number;
  created_by: string;
  created_at: string;
  ends_at: string;
  max_participants?: number;
  entry_fee?: number;
  is_public: boolean;
  status: "active" | "completed" | "cancelled";
  creator_profile: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  participants_count: number;
  user_participation?: {
    id: string;
    progress: number;
    completed: boolean;
    joined_at: string;
  };
}

interface GameSuggestion {
  id: string;
  title: string;
  description: string;
  suggested_by: string;
  votes: number;
  created_at: string;
  user_vote?: boolean;
  suggester_profile: {
    first_name: string;
    last_name: string;
  };
}

interface Leaderboard {
  user_id: string;
  total_xp: number;
  level: number;
  challenges_completed: number;
  profile: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

interface TriviaQuestion {
  question: string;
  answer: string;
}

const Social = () => {
  const [activeTab, setActiveTab] = useState<
    "challenges" | "leaderboard" | "suggestions" | "games"
  >("challenges");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [gameSuggestions, setGameSuggestions] = useState<GameSuggestion[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leaderboard[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [isSuggestingGame, setIsSuggestingGame] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<"quiz" | "coinflip" | "trivia">(
    "quiz"
  );
  const [quizScore, setQuizScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [coinResult, setCoinResult] = useState<"heads" | "tails" | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [isFlipping, setIsFlipping] = useState(false);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaAnswer, setTriviaAnswer] = useState("");
  const [triviaFeedback, setTriviaFeedback] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [triviaQuestions, setTriviaQuestions] = useState<TriviaQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const { currency } = useCurrency();

  const [newChallenge, setNewChallenge] = useState({
    title: "",
    description: "",
    type: "savings" as Challenge["type"],
    target_amount: "",
    duration_days: 7,
    xp_reward: 100,
    max_participants: "",
    entry_fee: "",
    is_public: true,
  });

  const [newSuggestion, setNewSuggestion] = useState({
    title: "",
    description: "",
  });

  const AI_MODEL = "mistralai/mistral-7b-instruct"; 

  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    fetchUser();
    fetchChallenges();
    fetchGameSuggestions();
    fetchLeaderboard();

    // Set up real-time subscriptions
    const challengesSubscription = supabase
      .channel("challenges_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "challenges",
        },
        () => {
          fetchChallenges();
        }
      )
      .subscribe();

    const suggestionsSubscription = supabase
      .channel("suggestions_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_suggestions",
        },
        () => {
          fetchGameSuggestions();
        }
      )
      .subscribe();

    return () => {
      challengesSubscription.unsubscribe();
      suggestionsSubscription.unsubscribe();
    };
  }, []);

  const fetchUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setUserProfile(profile);
    }
  };

  const fetchChallenges = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("challenges")
      .select(
        `*, 
        creator_profile:profiles!challenges_created_by_fkey(first_name, last_name, avatar_url),
        challenge_participants(count),
        user_participation:challenge_participants!left(id, progress, completed, joined_at)`
      )
      .eq("user_participation.user_id", user.id)
      .or(`is_public.eq.true,created_by.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching challenges:", error);
      return;
    }

    const formattedChallenges = data.map((challenge) => ({
      ...challenge,
      participants_count: challenge.challenge_participants[0]?.count || 0,
      user_participation: challenge.user_participation[0] || null,
    }));

    setChallenges(formattedChallenges);
  };

  const fetchGameSuggestions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("game_suggestions_with_votes")
      .select(
        `*,
        user_vote:suggestion_votes(vote_type, user_id),
        first_name,
        last_name`
      );

    if (error) {
      console.error("Error fetching game suggestions:", error);
      return;
    }

    const formattedSuggestions = data.map((suggestion) => {
      const vote = (suggestion.user_vote || []).find(
        (v) => v.user_id === user.id
      );
      return {
        ...suggestion,
        user_vote: vote?.vote_type === "up",
        suggester_profile: {
          first_name: suggestion.first_name,
          last_name: suggestion.last_name,
        },
      };
    });

    setGameSuggestions(formattedSuggestions);
  };

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `id,
        xp,
        level,
        first_name,
        last_name,
        avatar_url,
        challenge_participants(count)`
      )
      .order("xp", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching leaderboard:", error);
      return;
    }

    const formattedLeaderboard = data.map((profile) => ({
      user_id: profile.id,
      total_xp: profile.xp || 0,
      level: profile.level || 1,
      challenges_completed: profile.challenge_participants[0]?.count || 0,
      profile: {
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
      },
    }));

    setLeaderboard(formattedLeaderboard);
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + newChallenge.duration_days);

    const { error } = await supabase.from("challenges").insert([
      {
        title: newChallenge.title,
        description: newChallenge.description,
        type: newChallenge.type,
        target_amount: newChallenge.target_amount
          ? parseFloat(newChallenge.target_amount)
          : null,
        duration_days: newChallenge.duration_days,
        xp_reward: newChallenge.xp_reward,
        created_by: user.id,
        ends_at: endsAt.toISOString(),
        max_participants: newChallenge.max_participants
          ? parseInt(newChallenge.max_participants)
          : null,
        entry_fee: newChallenge.entry_fee
          ? parseFloat(newChallenge.entry_fee)
          : null,
        is_public: newChallenge.is_public,
        status: "active",
      },
    ]);

    if (error) {
      console.error("Error creating challenge:", error);
      toast.error("Failed to create challenge");
      return;
    }

    setNewChallenge({
      title: "",
      description: "",
      type: "savings",
      target_amount: "",
      duration_days: 7,
      xp_reward: 100,
      max_participants: "",
      entry_fee: "",
      is_public: true,
    });
    setIsCreatingChallenge(false);
    fetchChallenges();
    toast.success("Challenge created successfully! 🎉");
  };

  const handleJoinChallenge = async (challengeId: string) => {
    if (!user) return;

    const { error } = await supabase.from("challenge_participants").insert([
      {
        challenge_id: challengeId,
        user_id: user.id,
        progress: 0,
        completed: false,
      },
    ]);

    if (error) {
      console.error("Error joining challenge:", error);
      toast.error("Failed to join challenge");
      return;
    }

    fetchChallenges();
    toast.success("Successfully joined challenge! 💪");
  };

  const handleSuggestGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("game_suggestions").insert([
      {
        title: newSuggestion.title,
        description: newSuggestion.description,
        suggested_by: user.id,
      },
    ]);

    if (error) {
      console.error("Error suggesting game:", error);
      toast.error("Failed to suggest game");
      return;
    }

    setNewSuggestion({
      title: "",
      description: "",
    });
    setIsSuggestingGame(false);
    fetchGameSuggestions();
    toast.success("Game suggestion submitted! 💡");
  };

  const handleVoteSuggestion = async (
    suggestionId: string,
    voteType: boolean
  ) => {
    if (!user) return;

    // First, check if user already voted
    const { data: existingVote } = await supabase
      .from("suggestion_votes")
      .select("*")
      .eq("suggestion_id", suggestionId)
      .eq("user_id", user.id)
      .single();

    if (existingVote) {
      // Update existing vote
      const { error } = await supabase
        .from("suggestion_votes")
        .update({ vote_type: voteType ? "up" : "down" })
        .eq("id", existingVote.id);

      if (error) {
        console.error("Error updating vote:", error);
        return;
      }
    } else {
      // Create new vote
      const { error } = await supabase.from("suggestion_votes").insert([
        {
          suggestion_id: suggestionId,
          user_id: user.id,
          vote_type: voteType ? "up" : "down",
        },
      ]);

      if (error) {
        console.error("Error voting:", error);
        return;
      }
    }

    fetchGameSuggestions();
    toast.success(voteType ? "Upvoted! 👍" : "Downvoted! 👎");
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) return;

    // Create invitation link
    const inviteLink = `${window.location.origin}/register?ref=${user?.id}`;

    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied to clipboard! 📋");
    setInviteEmail("");
    setInviteModalOpen(false);
  };

  const getChallengeIcon = (type: Challenge["type"]) => {
    switch (type) {
      case "savings":
        return <PiggyBank className="w-5 h-5" />;
      case "spending_limit":
        return <Target className="w-5 h-5" />;
      case "streak":
        return <Zap className="w-5 h-5" />;
      default:
        return <Gamepad2 className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-100";
      case "completed":
        return "text-blue-600 bg-blue-100";
      case "cancelled":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const formatTimeRemaining = (endsAt: string) => {
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return "Ending soon";
  };

  const generateQuestions = async () => {
    setIsLoadingQuestions(true);

    try {
      // Generate quiz questions
      const quizResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "YOUR_SITE_URL", // Optional but recommended
            "X-Title": "Finance App", // Optional but recommended
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              {
                role: "system",
                content: `Generate 4 financial literacy quiz questions with 4 options each and indicate the correct answer. 
                Format your response as valid JSON: {
                  "questions": [
                    {
                      "question": "What is compound interest?",
                      "options": [
                        "Interest on principal only",
                        "Interest on principal plus accumulated interest",
                        "Fixed interest rate",
                        "Interest charged on loans"
                      ],
                      "answer": 1
                    }
                  ]
                }`,
              },
            ],
          }),
        }
      );

      const quizData = await quizResponse.json();
      if (!quizData.choices || quizData.choices.length === 0) {
        throw new Error("Invalid quiz response format");
      }
      const quizContent = quizData.choices[0].message?.content || "";

      // Parse JSON even if it's wrapped in code blocks
      let quizJson;
      try {
        quizJson = JSON.parse(quizContent);
      } catch (e) {
        const match = quizContent.match(/\{[\s\S]*\}/);
        if (match) quizJson = JSON.parse(match[0]);
        else throw new Error("Invalid JSON format");
      }

      setQuizQuestions(quizJson.questions);

      // Generate trivia questions
      const triviaResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173/",
            "X-Title": "Expenso",
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              {
                role: "system",
                content: `Generate 3 financial trivia questions with answers. 
                Format your response as valid JSON: {
                  "questions": [
                    {
                      "question": "What is the name of the first credit card?",
                      "answer": "Diners Club"
                    }
                  ]
                }`,
              },
            ],
          }),
        }
      );

      const triviaData = await triviaResponse.json();
      const triviaContent = triviaData.choices[0].message.content;

      if (quizData.error) {
        throw new Error(`API Error: ${quizData.error.message}`);
      }

      // Parse JSON even if it's wrapped in code blocks
      let triviaJson;
      try {
        triviaJson = JSON.parse(triviaContent);
      } catch (e) {
        const match = triviaContent.match(/\{[\s\S]*\}/);
        if (match) triviaJson = JSON.parse(match[0]);
        else throw new Error("Invalid JSON format");
      }

      setTriviaQuestions(triviaJson.questions);
    } catch (error) {
      console.error("Error generating questions:", error);
      toast.error("Failed to generate questions. Using default questions.");

      // Fallback to default questions
      setQuizQuestions([
        {
          question: "What is the recommended emergency fund amount?",
          options: [
            "1 month expenses",
            "3-6 months expenses",
            "1 year expenses",
            "No emergency fund needed",
          ],
          answer: 1,
        },
        {
          question: "Which investment has historically highest returns?",
          options: [
            "Savings accounts",
            "Government bonds",
            "Stocks",
            "Commodities",
          ],
          answer: 2,
        },
        {
          question: "What does APR stand for?",
          options: [
            "Annual Percentage Rate",
            "Average Payment Ratio",
            "Applied Principal Return",
            "Annual Profit Ratio",
          ],
          answer: 0,
        },
        {
          question: "What is compound interest?",
          options: [
            "Interest on principal only",
            "Interest on principal plus accumulated interest",
            "Fixed interest rate",
            "Interest charged on loans",
          ],
          answer: 1,
        },
      ]);

      setTriviaQuestions([
        {
          question: "What is the name of the first credit card?",
          answer: "Diners Club",
        },
        {
          question: "Which country first used paper money?",
          answer: "China",
        },
        {
          question:
            "What is the largest bill currently printed by the US Treasury?",
          answer: "$100",
        },
      ]);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Game functions
  const handleQuizAnswer = (answerIndex: number) => {
    if (!quizQuestions.length) return;

    if (answerIndex === quizQuestions[currentQuestion].answer) {
      setQuizScore(quizScore + 1);
      toast.success("Correct! +1 point");
    } else {
      toast.error("Incorrect answer");
    }

    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      toast.success(
        `Quiz completed! Your score: ${quizScore + 1}/${quizQuestions.length}`
      );
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setQuizScore(0);
    generateQuestions(); // Regenerate questions on reset
  };

  const flipCoin = () => {
    if (isFlipping) return;

    setIsFlipping(true);
    const result = Math.random() > 0.5 ? "heads" : "tails";

    setTimeout(() => {
      setCoinResult(result);
      setIsFlipping(false);

      if (result === "heads") {
        toast.success(`You won ${currency.symbol}${betAmount * 2}!`);
      } else {
        toast.error("Better luck next time!");
      }
    }, 1000);
  };

  const checkTriviaAnswer = () => {
    if (!triviaQuestions.length) return;

    const correctAnswer = triviaQuestions[0].answer.toLowerCase();
    const userAnswer = triviaAnswer.toLowerCase().trim();

    if (userAnswer === correctAnswer) {
      setTriviaScore(triviaScore + 1);
      setTriviaFeedback("Correct! Well done!");
      toast.success("Correct answer! +1 point");
    } else {
      setTriviaFeedback(`Incorrect. The answer is: ${correctAnswer}`);
      toast.error("Try another one!");
    }

    setTriviaAnswer("");
  };

  const nextTrivia = () => {
    // Rotate questions
    const newQuestions = [...triviaQuestions];
    const first = newQuestions.shift();
    if (first) newQuestions.push(first);
    setTriviaQuestions(newQuestions);
    setTriviaFeedback("");
  };

  // Load questions when games tab is active
  useEffect(() => {
    if (activeTab === "games" && quizQuestions.length === 0) {
      generateQuestions();
    }
  }, [activeTab]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="w-8 h-8 text-yellow-500" />
              Social Hub
            </h1>
            <p className="text-gray-600 mt-2">
              Challenge friends, compete, and improve your financial knowledge!
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setInviteModalOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite Friends</span>
            </Button>
            <Button
              onClick={() => {
                fetchChallenges();
                fetchGameSuggestions();
                fetchLeaderboard();
                toast.success("Data refreshed!");
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* User Stats */}
        {userProfile && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 md:p-6 rounded-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-bold">
                  {userProfile.first_name} {userProfile.last_name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    <span>Level {userProfile.level || 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>{userProfile.xp || 0} XP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>
                      {
                        challenges.filter(
                          (c) => c.user_participation?.completed
                        ).length
                      }{" "}
                      Completed
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-2xl font-bold">
                  #
                  {leaderboard.findIndex((l) => l.user_id === user?.id) + 1 ||
                    "N/A"}
                </div>
                <div className="text-sm opacity-75">Global Rank</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 border-b overflow-x-auto pb-1">
          {[
            { id: "challenges", label: "Challenges", icon: Trophy },
            { id: "leaderboard", label: "Leaderboard", icon: Crown },
            { id: "suggestions", label: "Ideas", icon: Lightbulb },
            { id: "games", label: "Games", icon: Gamepad2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors text-sm sm:text-base ${
                activeTab === id
                  ? "bg-yellow-500 text-black border-b-2 border-yellow-500"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Challenges Tab */}
        {activeTab === "challenges" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold">Financial Challenges</h2>
              <Button
                onClick={() => setIsCreatingChallenge(true)}
                variant="primary"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Challenge
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="bg-white rounded-lg shadow-lg p-4 sm:p-6 border-l-4 border-yellow-500 transition-transform hover:scale-[1.02]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getChallengeIcon(challenge.type)}
                      <h3 className="font-bold text-lg">{challenge.title}</h3>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        challenge.status
                      )}`}
                    >
                      {challenge.status}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">
                    {challenge.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    {challenge.target_amount && (
                      <div className="flex items-center gap-2 text-sm">
                        <IndianRupee className="w-4 h-4 text-green-500" />
                        <span>
                          Target: {currency.symbol}
                          {challenge.target_amount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>{formatTimeRemaining(challenge.ends_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-purple-500" />
                      <span>{challenge.participants_count} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>{challenge.xp_reward} XP reward</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold">
                          {challenge.creator_profile.first_name[0]}
                          {challenge.creator_profile.last_name[0]}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        by {challenge.creator_profile.first_name}
                      </span>
                    </div>

                    {challenge.user_participation ? (
                      <div className="flex items-center gap-2">
                        {challenge.user_participation.completed ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Completed
                          </span>
                        ) : (
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${challenge.user_participation.progress}%`,
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleJoinChallenge(challenge.id)}
                        variant="primary"
                        className="text-sm"
                        size="sm"
                      >
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {challenges.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  No challenges yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Be the first to create a financial challenge!
                </p>
                <Button
                  onClick={() => setIsCreatingChallenge(true)}
                  variant="primary"
                >
                  Create First Challenge
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Global Leaderboard</h2>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4">
                <h3 className="text-lg font-bold">Top Financial Champions</h3>
              </div>

              <div className="divide-y">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className={`p-4 flex items-center justify-between ${
                      entry.user_id === user?.id ? "bg-yellow-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0
                            ? "bg-yellow-500 text-white"
                            : index === 1
                            ? "bg-gray-400 text-white"
                            : index === 2
                            ? "bg-orange-600 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {index < 3 ? <Crown className="w-4 h-4" /> : index + 1}
                      </div>
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="font-bold">
                          {entry.profile.first_name[0]}
                          {entry.profile.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold">
                          {entry.profile.first_name} {entry.profile.last_name}
                          {entry.user_id === user?.id && (
                            <span className="text-yellow-600 ml-2">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          Level {entry.level} • {entry.challenges_completed}{" "}
                          challenges
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {entry.total_xp.toLocaleString()} XP
                      </div>
                      <div className="text-sm text-gray-600">
                        #{index + 1} globally
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game Suggestions Tab */}
        {activeTab === "suggestions" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold">Game Suggestions</h2>
              <Button
                onClick={() => setIsSuggestingGame(true)}
                variant="primary"
                className="flex items-center gap-2"
              >
                <Lightbulb className="w-4 h-4" />
                Suggest Game
              </Button>
            </div>

            <div className="space-y-4">
              {gameSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-white rounded-lg shadow p-4 sm:p-6 transition-transform hover:scale-[1.01]"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{suggestion.title}</h3>
                      <p className="text-gray-600 mt-2 text-sm">
                        {suggestion.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleVoteSuggestion(suggestion.id, true)
                        }
                        className={`p-2 rounded-full ${
                          suggestion.user_vote === true
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-600 hover:bg-green-50"
                        }`}
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <span className="font-bold min-w-[20px] text-center">
                        {suggestion.votes}
                      </span>
                      <button
                        onClick={() =>
                          handleVoteSuggestion(suggestion.id, false)
                        }
                        className={`p-2 rounded-full ${
                          suggestion.user_vote === false
                            ? "bg-red-100 text-red-600"
                            : "bg-gray-100 text-gray-600 hover:bg-red-50"
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 rotate-180" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm text-gray-500 gap-2">
                    <div>
                      Suggested by {suggestion.suggester_profile.first_name}{" "}
                      {suggestion.suggester_profile.last_name}
                    </div>
                    <div>
                      {new Date(suggestion.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {gameSuggestions.length === 0 && (
              <div className="text-center py-12">
                <Lightbulb className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  No game suggestions yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Share your ideas for new financial games and challenges!
                </p>
                <Button
                  onClick={() => setIsSuggestingGame(true)}
                  variant="primary"
                >
                  Suggest First Game
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Games Tab */}
        {activeTab === "games" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Financial Games</h2>

            <div className="flex flex-wrap gap-2 border-b pb-2">
              <button
                onClick={() => setActiveGame("quiz")}
                className={`px-4 py-2 rounded-lg ${
                  activeGame === "quiz"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Finance Quiz
              </button>
              <button
                onClick={() => setActiveGame("coinflip")}
                className={`px-4 py-2 rounded-lg ${
                  activeGame === "coinflip"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Coin Flip
              </button>
              <button
                onClick={() => setActiveGame("trivia")}
                className={`px-4 py-2 rounded-lg ${
                  activeGame === "trivia"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Daily Trivia
              </button>
            </div>

            {/* Quiz Game */}
            {activeGame === "quiz" && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Financial Literacy Quiz</h3>
                  <div className="bg-yellow-100 px-3 py-1 rounded-full">
                    Score: <span className="font-bold">{quizScore}</span>/
                    {quizQuestions.length}
                  </div>
                </div>

                {isLoadingQuestions ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
                    <p>Generating quiz questions...</p>
                  </div>
                ) : quizQuestions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      Failed to load quiz questions
                    </p>
                    <Button onClick={generateQuestions}>Retry</Button>
                  </div>
                ) : currentQuestion < quizQuestions.length ? (
                  <>
                    <div className="mb-6">
                      <div className="text-lg font-medium mb-2">
                        Question {currentQuestion + 1}:{" "}
                        {quizQuestions[currentQuestion].question}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {quizQuestions[currentQuestion].options.map(
                          (option, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleQuizAnswer(idx)}
                              className="bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
                            >
                              {option}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      Test your financial knowledge. Each correct answer earns
                      you 10 XP!
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Quiz Completed!</h3>
                    <p className="text-lg mb-6">
                      Your score: <span className="font-bold">{quizScore}</span>
                      /{quizQuestions.length}
                    </p>
                    <Button onClick={resetQuiz} variant="primary">
                      Play Again
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Coin Flip Game */}
            {activeGame === "coinflip" && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-6">Coin Flip Challenge</h3>

                <div className="flex flex-col items-center">
                  <div
                    className={`w-40 h-40 rounded-full flex items-center justify-center text-4xl font-bold mb-8 ${
                      isFlipping ? "animate-flip" : ""
                    } ${
                      coinResult === "heads"
                        ? "bg-yellow-400 text-yellow-800"
                        : coinResult === "tails"
                        ? "bg-gray-400 text-gray-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {coinResult === "heads"
                      ? "H"
                      : coinResult === "tails"
                      ? "T"
                      : "?"}
                  </div>

                  <div className="mb-6 w-full max-w-md">
                    <label className="block text-sm font-medium mb-2">
                      Bet Amount ({currency.symbol})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={betAmount}
                        onChange={(e) => setBetAmount(parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="bg-gray-100 px-3 py-1 rounded w-20 text-center">
                        {betAmount}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>5</span>
                      <span>100</span>
                    </div>
                  </div>

                  <Button
                    onClick={flipCoin}
                    variant="primary"
                    disabled={isFlipping}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isFlipping ? "animate-spin" : ""}`}
                    />
                    Flip for {currency.symbol}
                    {betAmount * 2}
                  </Button>

                  <div className="mt-6 text-sm text-gray-600 text-center">
                    <p>Double your money if you guess correctly!</p>
                    <p className="mt-2">
                      Current balance: {currency.symbol}1,250
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Trivia */}
            {activeGame === "trivia" && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Financial Trivia</h3>
                  <div className="bg-green-100 px-3 py-1 rounded-full">
                    Correct: <span className="font-bold">{triviaScore}</span>
                  </div>
                </div>

                {isLoadingQuestions ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
                    <p>Generating trivia questions...</p>
                  </div>
                ) : triviaQuestions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      Failed to load trivia questions
                    </p>
                    <Button onClick={generateQuestions}>Retry</Button>
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-lg font-medium mb-4">
                      {triviaQuestions[0].question}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={triviaAnswer}
                        onChange={(e) => setTriviaAnswer(e.target.value)}
                        placeholder="Your answer..."
                        className="flex-1 px-4 py-2 border rounded-lg"
                      />
                      <Button onClick={checkTriviaAnswer} variant="primary">
                        Submit
                      </Button>
                    </div>

                    {triviaFeedback && (
                      <div className="mt-4 p-3 rounded-lg bg-blue-50">
                        {triviaFeedback}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  <p>
                    Test your financial knowledge with daily trivia questions!
                  </p>
                  <p className="mt-2">Each correct answer earns 25 XP.</p>
                </div>

                {triviaFeedback && (
                  <div className="mt-6 text-center">
                    <Button onClick={nextTrivia} variant="outline">
                      Next Question →
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Challenge Modal */}
      {isCreatingChallenge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create New Challenge</h2>
            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={newChallenge.title}
                  onChange={(e) =>
                    setNewChallenge({ ...newChallenge, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Save 500 in 30 days"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={newChallenge.description}
                  onChange={(e) =>
                    setNewChallenge({
                      ...newChallenge,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder="Challenge yourself to save money by cutting unnecessary expenses..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newChallenge.type}
                  onChange={(e) =>
                    setNewChallenge({
                      ...newChallenge,
                      type: e.target.value as Challenge["type"],
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="savings">Savings Goal</option>
                  <option value="spending_limit">Spending Limit</option>
                  <option value="streak">Daily Streak</option>
                  <option value="custom">Custom Challenge</option>
                </select>
              </div>

              {(newChallenge.type === "savings" ||
                newChallenge.type === "spending_limit") && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Target Amount ({currency.symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newChallenge.target_amount}
                    onChange={(e) =>
                      setNewChallenge({
                        ...newChallenge,
                        target_amount: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="500.00"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Duration (days)
                </label>
                <input
                  type="number"
                  value={newChallenge.duration_days}
                  onChange={(e) =>
                    setNewChallenge({
                      ...newChallenge,
                      duration_days: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  min="1"
                  max="365"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  XP Reward
                </label>
                <input
                  type="number"
                  value={newChallenge.xp_reward}
                  onChange={(e) =>
                    setNewChallenge({
                      ...newChallenge,
                      xp_reward: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  min="10"
                  max="1000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Participants (optional)
                </label>
                <input
                  type="number"
                  value={newChallenge.max_participants}
                  onChange={(e) =>
                    setNewChallenge({
                      ...newChallenge,
                      max_participants: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Entry Fee ({currency.symbol}) (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newChallenge.entry_fee}
                  onChange={(e) =>
                    setNewChallenge({
                      ...newChallenge,
                      entry_fee: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={newChallenge.is_public}
                  onChange={(e) =>
                    setNewChallenge({
                      ...newChallenge,
                      is_public: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <label htmlFor="is_public" className="text-sm">
                  Make this challenge public
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsCreatingChallenge(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Challenge
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suggest Game Modal */}
      {isSuggestingGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Suggest New Game</h2>
            <form onSubmit={handleSuggestGame} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Game Title
                </label>
                <input
                  type="text"
                  value={newSuggestion.title}
                  onChange={(e) =>
                    setNewSuggestion({
                      ...newSuggestion,
                      title: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Expense Bingo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={newSuggestion.description}
                  onChange={(e) =>
                    setNewSuggestion({
                      ...newSuggestion,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  rows={4}
                  placeholder="A bingo game where players mark off different types of expenses they avoid..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsSuggestingGame(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Submit Suggestion
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Invite Friends</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Friend's Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="friend@example.com"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-semibold mb-2">Invite Link</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/register?ref=${user?.id}`}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded bg-white text-sm"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/register?ref=${user?.id}`
                      );
                      toast.success("Link copied!");
                    }}
                    variant="outline"
                    className="p-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setInviteModalOpen(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} variant="primary">
                  Send Invite
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Social;
