import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Send,
  Mic,
  MicOff,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  TrendingDown,
  TrendingUp,
  Wallet,
  Calendar,
  Tag,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCurrency } from "../../contexts/CurrencyContext";
import {
  conversationManager,
  ConversationTurn,
} from "../../services/conversationManager";
import {
  TransactionRecord,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  TransactionDraft,
} from "../../services/transactionService";
import {
  getFinancialSummary,
  FinancialSummary,
} from "../../services/financialQueryService";
import { parseDateRange, formatFriendlyDate } from "../../services/dateService";
import { modelAdapter, ModelHealth } from "../../services/ai/modelAdapter";

const SUGGESTED_PROMPTS = [
  "I got my salary today",
  "I spent ₹450 on dinner yesterday",
  "I received ₹5,000 from freelance yesterday",
  "I spent 200 on coffee this morning",
  "How much did I spend this month?",
  "Compare this month with last month",
  "What is my biggest expense category?",
];

export const PennyAssistant: React.FC = () => {
  const { currency } = useCurrency();
  const currSym = currency.symbol || "₹";

  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);

  // Live financial stats
  const [stats, setStats] = useState<FinancialSummary | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Manual entry modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    type: "expense" as "expense" | "income",
    amount: "",
    description: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
  });

  // Edit transaction modal
  const [editingTransaction, setEditingTransaction] = useState<TransactionRecord | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    description: "",
    category: "",
    date: "",
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<{ id: string; type: "income" | "expense" } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Initialize Speech Recognition if supported in browser
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Check auth & load financial summary
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        await refreshFinancialStats(session.user.id);
      }

      // Check AI model health
      const health = await modelAdapter.checkHealth();
      setModelHealth(health);

      // Add friendly welcome turn if no messages
      setMessages([
        {
          id: "welcome",
          sender: "penny",
          text: `Hi there! I'm **Penny**, your intelligent personal finance assistant.\n\nYou can chat with me naturally to log income and expenses, ask questions about your spending, or track your savings without filling out complicated forms.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    init();
  }, []);

  // If initial query provided via URL params, run it once userId is available
  useEffect(() => {
    if (initialQuery && userId && messages.length <= 1) {
      handleSend(initialQuery);
    }
  }, [userId, initialQuery]);

  const refreshFinancialStats = async (uid: string) => {
    setIsLoadingStats(true);
    try {
      const thisMonthRange = parseDateRange("this month", new Date());
      const summary = await getFinancialSummary(uid, thisMonthRange);
      setStats(summary);
    } catch (err) {
      console.error("Error refreshing stats:", err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || !userId || isProcessing) return;

    setInput("");
    setIsProcessing(true);

    const userTurn: ConversationTurn = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userTurn]);

    try {
      const res = await conversationManager.handleMessage(textToSend, userId, currSym, new Date());

      const pennyTurn: ConversationTurn = {
        id: `penny_${Date.now()}`,
        sender: "penny",
        text: res.reply,
        timestamp: new Date().toISOString(),
        transaction: res.recordedTransaction || res.updatedTransaction,
        statusBadge: res.recordedTransaction
          ? "recorded"
          : res.updatedTransaction
          ? "updated"
          : res.deletedTransactionId
          ? "deleted"
          : res.isAwaitingInput
          ? "clarification"
          : "query",
      };

      setMessages((prev) => [...prev, pennyTurn]);

      // If a transaction was created, updated, or deleted, refresh live stats
      if (res.recordedTransaction || res.updatedTransaction || res.deletedTransactionId) {
        await refreshFinancialStats(userId);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `penny_err_${Date.now()}`,
          sender: "penny",
          text: "I ran into an unexpected error processing that. Please try again or use the manual entry option.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Edit Transaction from card
  const openEditModal = (tx: TransactionRecord) => {
    setEditingTransaction(tx);
    setEditForm({
      amount: String(tx.amount),
      description: tx.description,
      category: tx.category,
      date: tx.date,
    });
  };

  const saveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !userId) return;

    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) return;

    const res = await updateTransaction(userId, editingTransaction.id, editingTransaction.type, {
      amount: amt,
      description: editForm.description,
      category: editForm.category,
      date: editForm.date,
    });

    if (res.success && res.record) {
      setMessages((prev) => [
        ...prev,
        {
          id: `penny_edit_${Date.now()}`,
          sender: "penny",
          text: `Got it! I've updated your ${res.record.type} record to ${currSym}${res.record.amount.toLocaleString()} for ${res.record.description}.`,
          timestamp: new Date().toISOString(),
          transaction: res.record,
          statusBadge: "updated",
        },
      ]);
      setEditingTransaction(null);
      await refreshFinancialStats(userId);
    }
  };

  // Handle Delete Transaction from card
  const confirmDelete = async () => {
    if (!deletingId || !userId) return;

    const res = await deleteTransaction(userId, deletingId.id, deletingId.type);
    if (res.success) {
      setMessages((prev) => [
        ...prev,
        {
          id: `penny_del_${Date.now()}`,
          sender: "penny",
          text: "The transaction has been deleted from your account records.",
          timestamp: new Date().toISOString(),
          statusBadge: "deleted",
        },
      ]);
      setDeletingId(null);
      await refreshFinancialStats(userId);
    }
  };

  // Handle Manual Transaction Entry
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const amt = parseFloat(manualForm.amount);
    if (isNaN(amt) || amt <= 0) return;

    const draft: TransactionDraft = {
      type: manualForm.type,
      amount: amt,
      currency: "INR",
      description: manualForm.description || (manualForm.type === "income" ? "Income" : "Expense"),
      category: manualForm.category || (manualForm.type === "income" ? "Salary" : "General"),
      transactionDate: manualForm.date,
      confidence: 1.0,
      missingFields: [],
      requiresConfirmation: false,
    };

    const res = await createTransaction(draft, userId);
    if (res.success && res.record) {
      setIsManualModalOpen(false);
      setManualForm({
        type: "expense",
        amount: "",
        description: "",
        category: "",
        date: new Date().toISOString().split("T")[0],
      });

      const friendly = formatFriendlyDate(res.record.date);
      setMessages((prev) => [
        ...prev,
        {
          id: `penny_manual_${Date.now()}`,
          sender: "penny",
          text: `Recorded ${currSym}${res.record.amount.toLocaleString()} for ${res.record.description} on ${friendly} under ${res.record.category}.`,
          timestamp: new Date().toISOString(),
          transaction: res.record,
          statusBadge: "recorded",
        },
      ]);

      await refreshFinancialStats(userId);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-6xl mx-auto px-4 py-4 gap-4">
      {/* ── Top Header & Live Financial Summary ────────────────────────── */}
      <div className="glass-card p-4 rounded-2xl border border-white/10 shadow-xl bg-gradient-to-r from-white/[0.03] to-yellow/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff3c02] to-amber-500 flex items-center justify-center text-white text-xl shadow-lg shadow-[#ff3c02]/30">
              🪙
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">Penny</h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow/20 text-yellow border border-yellow/30">
                  AI Personal Finance
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Natural-language expense & income tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model status indicator */}
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                modelHealth?.isAvailable
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/30"
              }`}
              title={
                modelHealth?.isAvailable
                  ? `Connected to ${modelHealth.model} (${modelHealth.latencyMs}ms)`
                  : "Running in deterministic offline rule-based mode"
              }
            >
              <Cpu size={13} />
              <span>
                {modelHealth?.isAvailable
                  ? `Ollama: ${modelHealth.model}`
                  : "Deterministic Rule-Engine"}
              </span>
            </div>

            {/* Quick manual entry button */}
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors"
            >
              <Plus size={14} />
              <span>Manual Entry</span>
            </button>
          </div>
        </div>

        {/* Live Month Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
          <div className="glass-inset p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-semibold text-gray-400">This Month's Spend</p>
            <p className="text-base font-bold text-white mt-0.5">
              {isLoadingStats ? "..." : `${currSym}${stats?.totalExpenses.toLocaleString() ?? 0}`}
            </p>
          </div>
          <div className="glass-inset p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-semibold text-gray-400">This Month's Income</p>
            <p className="text-base font-bold text-emerald-400 mt-0.5">
              {isLoadingStats ? "..." : `${currSym}${stats?.totalIncome.toLocaleString() ?? 0}`}
            </p>
          </div>
          <div className="glass-inset p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-semibold text-gray-400">Net Cash Flow</p>
            <p
              className={`text-base font-bold mt-0.5 ${
                (stats?.netCashFlow || 0) >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isLoadingStats
                ? "..."
                : `${(stats?.netCashFlow || 0) >= 0 ? "+" : ""}${currSym}${stats?.netCashFlow.toLocaleString() ?? 0}`}
            </p>
          </div>
          <div className="glass-inset p-2.5 rounded-xl">
            <p className="text-[10px] uppercase font-semibold text-gray-400">Top Spend Category</p>
            <p className="text-base font-bold text-yellow truncate mt-0.5">
              {isLoadingStats
                ? "..."
                : stats?.biggestCategory
                ? `${stats.biggestCategory.category} (${stats.biggestCategory.percentage}%)`
                : "None"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Secondary Nav Shortcut Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1 overflow-x-auto gap-2">
        <span className="font-medium whitespace-nowrap">Quick Navigation:</span>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Link
            to="/dashboard"
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <Link
            to="/expenses"
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
          >
            Expenses
          </Link>
          <Link
            to="/income"
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
          >
            Income
          </Link>
          <Link
            to="/budget"
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
          >
            Budget
          </Link>
          <Link
            to="/reports"
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
          >
            Reports
          </Link>
        </div>
      </div>

      {/* ── Main Conversation Stream ─────────────────────────────────── */}
      <div className="flex-1 glass-card p-4 rounded-2xl overflow-y-auto space-y-4 border border-white/10 shadow-inner">
        {messages.map((turn) => {
          const isUser = turn.sender === "user";

          return (
            <div
              key={turn.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[70%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-md ${
                  isUser
                    ? "bg-gradient-to-r from-[#ff3c02] to-amber-600 text-white rounded-br-none"
                    : "glass-card border border-white/10 text-gray-100 rounded-bl-none bg-white/[0.04]"
                }`}
              >
                {!isUser && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-yellow text-xs font-semibold">
                    <span>🪙 Penny</span>
                    {turn.statusBadge === "recorded" && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Saved to DB
                      </span>
                    )}
                    {turn.statusBadge === "updated" && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Updated
                      </span>
                    )}
                    {turn.statusBadge === "deleted" && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        Deleted
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{turn.text}</div>

                {/* ── Render Interactive Transaction Card ───────────── */}
                {turn.transaction && (
                  <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/10 text-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          turn.transaction.type === "income"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {turn.transaction.type}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={11} />
                        {turn.transaction.date}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="font-semibold text-sm">{turn.transaction.description}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Tag size={11} />
                          {turn.transaction.category}
                        </p>
                      </div>
                      <p
                        className={`text-lg font-extrabold ${
                          turn.transaction.type === "income" ? "text-emerald-400" : "text-white"
                        }`}
                      >
                        {turn.transaction.type === "income" ? "+" : "-"}
                        {currSym}
                        {turn.transaction.amount.toLocaleString()}
                      </p>
                    </div>

                    {/* Quick action buttons */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2 text-xs">
                      <button
                        onClick={() => openEditModal(turn.transaction!)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors"
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() =>
                          setDeletingId({
                            id: turn.transaction!.id,
                            type: turn.transaction!.type,
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-500 mt-1 px-1">
                {new Date(turn.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-start gap-2">
            <div className="glass-card border border-white/10 p-3 rounded-2xl rounded-bl-none text-xs text-yellow flex items-center gap-2">
              <RefreshCw className="animate-spin" size={14} />
              <span>Penny is processing your request...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggested Prompt Chips ────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none text-xs">
        <span className="text-gray-400 text-[11px] whitespace-nowrap flex items-center gap-1">
          <Sparkles size={12} className="text-yellow" /> Suggestions:
        </span>
        {SUGGESTED_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={isProcessing}
            className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-yellow/30 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* ── Prominent Conversational Input Field ──────────────────────── */}
      <div className="glass-card p-2 rounded-2xl border border-white/15 shadow-2xl bg-black/40">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* Voice Input Button */}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition-all ${
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50"
                  : "bg-white/10 text-gray-300 hover:text-white hover:bg-white/15"
              }`}
              title={isListening ? "Listening... click to stop" : "Click to speak"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Penny what you spent or earned (e.g. 'I spent ₹450 on dinner yesterday')..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none"
            disabled={isProcessing}
          />

          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="p-2.5 rounded-xl bg-gradient-to-r from-[#ff3c02] to-amber-500 text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-md shadow-[#ff3c02]/20"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────── */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl w-full max-w-md border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-yellow" />
                Edit Transaction
              </h3>
              <button
                onClick={() => setEditingTransaction(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveEditModal} className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Amount ({currSym})</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Description</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff3c02] to-amber-500 text-white text-xs font-semibold shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl w-full max-w-sm border border-red-500/30 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
              <AlertCircle size={18} className="text-red-400" />
              Delete Transaction?
            </h3>
            <p className="text-xs text-gray-300 mb-4">
              Are you sure you want to delete this recorded transaction? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-md shadow-red-500/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Entry Modal ─────────────────────────────────────────── */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl w-full max-w-md border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-yellow" />
                Add Transaction Manually
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4 text-sm">
              <div className="flex rounded-xl bg-black/30 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setManualForm({ ...manualForm, type: "expense" })}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    manualForm.type === "expense"
                      ? "bg-gradient-to-r from-[#ff3c02] to-amber-500 text-white shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setManualForm({ ...manualForm, type: "income" })}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    manualForm.type === "income"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Amount ({currSym})</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 450"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Description</label>
                <input
                  type="text"
                  placeholder={manualForm.type === "income" ? "e.g. Salary" : "e.g. Dinner with friends"}
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Category</label>
                <input
                  type="text"
                  placeholder={manualForm.type === "income" ? "e.g. Salary" : "e.g. Food & Dining"}
                  value={manualForm.category}
                  onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs mb-1 font-semibold">Date</label>
                <input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  required
                  className="w-full glass-inset px-3 py-2 rounded-xl text-white focus:outline-none border border-white/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff3c02] to-amber-500 text-white text-xs font-semibold shadow-md"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PennyAssistant;

