import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  Zap,
  ClipboardPaste,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Loader2,
  Smartphone,
  Info,
  ChevronDown,
} from "lucide-react";
import upilogo from '../../public/upi.png'
import Button from "../components/common/Button";

/** A UPI transaction parsed out of an SMS / app-notification text */
interface ParsedTxn {
  id: string; // local id
  amount: number;
  direction: "debit" | "credit";
  merchant: string;
  vpa: string | null;
  ref: string | null;
  date: string; // YYYY-MM-DD
  raw: string;
  selected: boolean;
  status: "pending" | "imported" | "duplicate" | "error";
}

const UPI_CATEGORY_NAME = "UPI";
const UPI_CATEGORY_COLOR = "#45B7D1";
const SEEN_REFS_KEY = "expenso_upi_seen_refs";
const AUTO_CAPTURE_KEY = "expenso_upi_auto_capture";

/* ---------- parsing helpers ---------- */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseDate = (text: string): string => {
  // 12-Jun-26 / 12 Jun 2026 / 12-jun-2026
  let m = text.match(/(\d{1,2})[-\s/]([A-Za-z]{3})[a-z]*[-\s/](\d{2,4})/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, parseInt(m[1], 10));
      if (!isNaN(d.getTime())) return toISODate(d);
    }
  }
  // 12/06/2026 or 12-06-26 (assume DD/MM/YYYY, the Indian convention)
  m = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) return toISODate(d);
  }
  return toISODate(new Date());
};

/**
 * Parse one message blob into a transaction.
 * Understands common GPay / PhonePe / Paytm / bank SMS formats, e.g.
 *  "Rs.249.00 debited from A/c XX1234 on 05-Jul-26 to VPA swiggy@ybl (UPI Ref No 518812345678)"
 *  "You paid ₹120 to Ramesh Tea Stall via Google Pay. UPI transaction ID: 51881..."
 *  "INR 1,500.00 credited to your A/c via UPI from rahul@okaxis"
 */
export const parseUpiMessage = (raw: string): Omit<ParsedTxn, "id" | "selected" | "status"> | null => {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const amountMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (!amount || isNaN(amount)) return null;

  const isDebit = /debit|paid|sent|payment of|purchase|spent|withdrawn/i.test(text);
  const isCredit = /credit|received|deposited|refund/i.test(text);
  // A UPI message must at least look like a transaction
  if (!isDebit && !isCredit) return null;
  // Messages can mention both ("debited ... credited to beneficiary") — debit wins
  const direction: "debit" | "credit" = isDebit ? "debit" : "credit";

  const vpaMatch = text.match(/([a-z0-9][a-z0-9.\-_]{1,}@[a-z][a-z0-9]{1,})/i);
  const vpa = vpaMatch ? vpaMatch[1].toLowerCase() : null;

  const refMatch =
    text.match(/(?:ref(?:erence)?\s*(?:no|number)?\.?\s*:?\s*)(\d{6,})/i) ||
    text.match(/(?:utr|txn\s*id|transaction\s*id)\s*:?\s*([a-z0-9]{6,})/i) ||
    text.match(/\b(\d{12})\b/);
  const ref = refMatch ? refMatch[1] : null;

  // Merchant: "to <name>" / "at <name>" / "<name> credited" / fall back to VPA handle
  let merchant = "";
  const toMatch = text.match(/\b(?:to|at)\s+(?:vpa\s+)?(?!your\b|a\/c|account\b)([A-Za-z][A-Za-z0-9 &.'-]{2,40}?)(?=\s+(?:on|via|upi|ref|through|from|txn|a\/c)\b|[.,(]|$)/i);
  if (toMatch) merchant = toMatch[1].trim();
  if (!merchant && direction === "debit") {
    // e.g. "...debited for Rs 560.00 on 08-Jul-26; Big Bazaar credited."
    const beneficiary = text.match(/[;,]\s*([A-Za-z][A-Za-z0-9 &.'-]{2,40}?)\s+credited/i);
    if (beneficiary) merchant = beneficiary[1].trim();
  }
  if (!merchant && vpa) merchant = vpa.split("@")[0].replace(/[._-]/g, " ");
  if (!merchant) merchant = direction === "debit" ? "UPI payment" : "UPI credit";

  return {
    amount,
    direction,
    merchant,
    vpa,
    ref,
    date: parseDate(text),
    raw: text,
  };
};

/** Split pasted text into candidate messages (blank lines or one per line). */
const splitMessages = (text: string): string[] => {
  const blocks = text.split(/\n\s*\n/).flatMap((block) => {
    // If a block has several lines that each look like their own SMS, split per line
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const smsLike = lines.filter((l) => /(?:rs\.?|inr|₹)\s*[\d,]/i.test(l));
    return smsLike.length > 1 ? lines : [block];
  });
  return blocks.map((b) => b.trim()).filter(Boolean);
};

/* ---------- component ---------- */

const UpiSync = () => {
  const { currency } = useCurrency();
  const [pasteText, setPasteText] = useState("");
  const [txns, setTxns] = useState<ParsedTxn[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [autoCapture, setAutoCapture] = useState(
    () => localStorage.getItem(AUTO_CAPTURE_KEY) === "1"
  );
  // Collapsible sections — collapsed state sticks across visits
  const [infoOpen, setInfoOpen] = useState(
    () => localStorage.getItem("expenso_upi_info_open") !== "0"
  );
  const [captureOpen, setCaptureOpen] = useState(
    () => localStorage.getItem("expenso_upi_capture_open") !== "0"
  );

  const toggleSection = (section: "info" | "capture") => {
    if (section === "info") {
      setInfoOpen((open) => {
        localStorage.setItem("expenso_upi_info_open", open ? "0" : "1");
        return !open;
      });
    } else {
      setCaptureOpen((open) => {
        localStorage.setItem("expenso_upi_capture_open", open ? "0" : "1");
        return !open;
      });
    }
  };
  const seenRefs = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem(SEEN_REFS_KEY) || "[]"))
  );
  const lastClipboard = useRef<string>("");
  const [searchParams, setSearchParams] = useSearchParams();

  const rememberRef = (ref: string) => {
    seenRefs.current.add(ref);
    localStorage.setItem(
      SEEN_REFS_KEY,
      JSON.stringify(Array.from(seenRefs.current).slice(-500))
    );
  };

  const addParsed = useCallback((raws: string[]): number => {
    const parsed: ParsedTxn[] = [];
    for (const raw of raws) {
      const p = parseUpiMessage(raw);
      if (!p) continue;
      if (p.ref && seenRefs.current.has(p.ref)) continue; // already imported earlier
      parsed.push({
        ...p,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        selected: true,
        status: "pending",
      });
    }
    if (parsed.length > 0) {
      setTxns((prev) => {
        const existingRefs = new Set(prev.map((t) => t.ref).filter(Boolean));
        const existingRaw = new Set(prev.map((t) => t.raw));
        return [
          ...prev,
          ...parsed.filter(
            (t) => !existingRaw.has(t.raw) && (!t.ref || !existingRefs.has(t.ref))
          ),
        ];
      });
    }
    return parsed.length;
  }, []);

  const handleParse = () => {
    const found = addParsed(splitMessages(pasteText));
    setMessage(
      found > 0
        ? { kind: "ok", text: `Detected ${found} UPI transaction${found > 1 ? "s" : ""}. Review and import below.` }
        : { kind: "warn", text: "No UPI transactions found in that text. Paste the full SMS/notification, including the amount." }
    );
    if (found > 0) setPasteText("");
  };

  /* Web Share Target: on Android, sharing an SMS/notification to the installed
     app lands here as ?title=...&text=... — parse it immediately. If the share
     arrived while logged out, ProtectedRoute stashed it in localStorage. */
  useEffect(() => {
    let params: URLSearchParams = searchParams;
    let fromStorage = false;

    if (![params.get("title"), params.get("text"), params.get("url")].some(Boolean)) {
      const pending = localStorage.getItem("expenso_pending_share");
      if (!pending) return;
      params = new URLSearchParams(pending);
      fromStorage = true;
    }

    const sharedText = [params.get("title"), params.get("text"), params.get("url")]
      .filter(Boolean)
      .join("\n");

    if (fromStorage) {
      localStorage.removeItem("expenso_pending_share");
    } else {
      setSearchParams({}, { replace: true });
    }
    if (!sharedText.trim()) return;

    const found = addParsed(splitMessages(sharedText));
    setMessage(
      found > 0
        ? { kind: "ok", text: `Received ${found} UPI transaction${found > 1 ? "s" : ""} from share. Review and import below.` }
        : { kind: "warn", text: "The shared text didn't contain a recognizable UPI transaction." }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, addParsed]);

  /* Auto-capture: read clipboard whenever the tab regains focus */
  useEffect(() => {
    if (!autoCapture) return;

    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || text === lastClipboard.current) return;
        lastClipboard.current = text;
        const found = addParsed(splitMessages(text));
        if (found > 0) {
          setMessage({
            kind: "ok",
            text: `Auto-captured ${found} UPI transaction${found > 1 ? "s" : ""} from your clipboard.`,
          });
        }
      } catch {
        // Clipboard permission denied or unavailable — ignore silently
      }
    };

    checkClipboard();
    window.addEventListener("focus", checkClipboard);
    return () => window.removeEventListener("focus", checkClipboard);
  }, [autoCapture, addParsed]);

  const toggleAutoCapture = () => {
    const next = !autoCapture;
    setAutoCapture(next);
    localStorage.setItem(AUTO_CAPTURE_KEY, next ? "1" : "0");
  };

  /** Find or create the "UPI" expense category for this user */
  const ensureUpiCategory = async (userId: string): Promise<string | null> => {
    const { data: existing } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", UPI_CATEGORY_NAME)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from("expense_categories")
      .insert([{ name: UPI_CATEGORY_NAME, color: UPI_CATEGORY_COLOR, user_id: userId }])
      .select("id")
      .single();
    if (error) {
      console.error("Error creating UPI category:", error);
      return null;
    }
    return created.id;
  };

  /** Pick an income category for UPI credits ("UPI" > "Other" > first available) */
  const findIncomeCategory = async (): Promise<string | null> => {
    const { data: categories } = await supabase
      .from("income_categories")
      .select("id, name")
      .order("name");
    if (!categories || categories.length === 0) return null;

    const byName = (needle: string) =>
      categories.find((c) => c.name?.toLowerCase().includes(needle));
    return (byName("upi") ?? byName("other") ?? categories[0]).id;
  };

  const importSelected = async () => {
    const selected = txns.filter((t) => t.selected && t.status === "pending");
    if (selected.length === 0) {
      setMessage({ kind: "warn", text: "Nothing selected to import. Tick the transactions you want to add." });
      return;
    }

    setImporting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setImporting(false);
      return;
    }

    const needsExpense = selected.some((t) => t.direction === "debit");
    const needsIncome = selected.some((t) => t.direction === "credit");
    const expenseCategoryId = needsExpense ? await ensureUpiCategory(user.id) : null;
    const incomeCategoryId = needsIncome ? await findIncomeCategory() : null;

    let importedExpenses = 0;
    let importedIncome = 0;
    let duplicates = 0;

    for (const txn of selected) {
      const targetTable = txn.direction === "debit" ? "expenses" : "income";
      try {
        // Dedupe against rows already in the database (by UPI ref in the description)
        if (txn.ref) {
          const { data: dupe } = await supabase
            .from(targetTable)
            .select("id")
            .eq("user_id", user.id)
            .ilike("description", `%${txn.ref}%`)
            .limit(1);
          if (dupe && dupe.length > 0) {
            setTxns((prev) =>
              prev.map((t) => (t.id === txn.id ? { ...t, status: "duplicate" } : t))
            );
            rememberRef(txn.ref);
            duplicates++;
            continue;
          }
        }

        const description = `${txn.merchant}${txn.vpa ? ` (${txn.vpa})` : ""} — UPI${
          txn.ref ? ` Ref ${txn.ref}` : ""
        }`;

        if (txn.direction === "debit") {
          const { data: expense, error: expenseError } = await supabase
            .from("expenses")
            .insert([
              {
                amount: txn.amount,
                description,
                date: txn.date,
                user_id: user.id,
              },
            ])
            .select()
            .single();
          if (expenseError) throw expenseError;

          if (expenseCategoryId) {
            await supabase.from("expense_category_mappings").insert([
              { expense_id: expense.id, category_id: expenseCategoryId, user_id: user.id },
            ]);

            // Keep the budget's "spent" in sync, same as manual expense entry
            const month = `${txn.date.slice(0, 7)}-01`;
            const { data: budget } = await supabase
              .from("budgets")
              .select("*")
              .eq("category_id", expenseCategoryId)
              .eq("month", month)
              .maybeSingle();
            if (budget) {
              await supabase
                .from("budgets")
                .update({ spent: budget.spent + txn.amount })
                .eq("id", budget.id);
            }
          }
          importedExpenses++;
        } else {
          // Credit → income row. Dashboard/Reports sum in_hand_amount || amount,
          // so setting both keeps every existing total consistent.
          const { error: incomeError } = await supabase.from("income").insert([
            {
              amount: txn.amount,
              in_hand_amount: txn.amount,
              description,
              date: txn.date,
              is_holiday: false,
              ...(incomeCategoryId ? { category_id: incomeCategoryId } : {}),
              user_id: user.id,
            },
          ]);
          if (incomeError) throw incomeError;
          importedIncome++;
        }

        if (txn.ref) rememberRef(txn.ref);
        setTxns((prev) =>
          prev.map((t) => (t.id === txn.id ? { ...t, status: "imported" } : t))
        );
      } catch (error) {
        console.error("Error importing UPI transaction:", error);
        setTxns((prev) =>
          prev.map((t) => (t.id === txn.id ? { ...t, status: "error" } : t))
        );
      }
    }

    setImporting(false);
    const parts: string[] = [];
    if (importedExpenses > 0) parts.push(`${importedExpenses} expense${importedExpenses > 1 ? "s" : ""}`);
    if (importedIncome > 0) parts.push(`${importedIncome} income entr${importedIncome > 1 ? "ies" : "y"}`);
    if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates > 1 ? "s" : ""} skipped`);
    setMessage({
      kind: "ok",
      text: parts.length > 0 ? `Imported: ${parts.join(", ")}.` : "Nothing imported.",
    });
  };

  const pendingSelectable = txns.filter((t) => t.status === "pending");

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <img src={upilogo} alt="Expenso Logo" className="w-8 h-8 object-contain" />
        <div>
          <h1 className="text-3xl font-bold">UPI Sync</h1>
          <p className="text-slate-300">
            Debits become expenses, credits become income — automatically.
          </p>
        </div>
      </div>

      {/* How it works (collapsible) */}
      <div className="glass-inset my-6 overflow-hidden">
        <button
          onClick={() => toggleSection("info")}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/[0.04] transition-colors"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-white">
            <Info className="w-5 h-5 flex-shrink-0 text-sky-400" />
            How UPI capture works
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
              infoOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {infoOpen && (
          <p className="px-4 pb-4 pl-12 text-sm text-slate-300">
            Phones don't let websites read the SMS inbox, so Expenso captures
            UPI payments three ways: on Android, open the payment
            SMS/notification and <strong>Share → Expenso</strong> (works once
            the app is installed); <strong>paste</strong> any number of messages
            below; or turn on <strong>auto-capture</strong> — copy a payment
            message and it's picked up the moment you return to this app.
            Debited amounts are added to your <strong>expenses</strong> (with
            budgets updated), credited amounts to your <strong>income</strong> —
            so your balance always adds up. Works with GPay, PhonePe, Paytm and
            bank SMS formats; duplicates are detected by UPI reference number.
          </p>
        )}
      </div>

      {/* Auto-capture toggle (collapsible; switch stays reachable in the header) */}
      <div className="glass-card mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
          <button
            onClick={() => toggleSection("capture")}
            className="flex items-center gap-3 text-left flex-1 min-w-0"
          >
            <Smartphone className="w-6 h-6 text-slate-200 flex-shrink-0" />
            <span className="text-base sm:text-lg font-semibold text-white truncate">
              Auto-capture from clipboard
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
                captureOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          <button
            onClick={toggleAutoCapture}
            role="switch"
            aria-checked={autoCapture}
            className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 border ${
              autoCapture
                ? "bg-gradient-to-br from-yellow to-amber-400 border-amber-300 shadow-md shadow-amber-400/40"
                : "bg-white/[0.07] border-white/20"
            }`}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-[#16171d] shadow transition-all ${
                autoCapture ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
        {captureOpen && (
          <p className="px-4 sm:px-5 pb-4 sm:pb-5 pl-[52px] sm:pl-[56px] -mt-2 text-sm text-slate-300">
            While this page is open, copied UPI messages are detected
            automatically — {autoCapture ? "currently on." : "currently off."}
          </p>
        )}
      </div>

      {/* Paste area */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <ClipboardPaste className="w-5 h-5" />
          Paste UPI messages
        </h2>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 text-sm font-mono"
          placeholder={`Rs.249.00 debited from A/c XX1234 on ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })} to VPA swiggy@ybl (UPI Ref No 518812345678)\n\nYou paid ₹120 to Ramesh Tea Stall via Google Pay. UPI transaction ID: 519987654321`}
        />
        <div className="mt-3 flex justify-end">
          <Button
            onClick={handleParse}
            variant="primary"
            disabled={!pasteText.trim()}
          >
            <Zap className="w-4 h-4 mr-2" />
            Detect transactions
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={`glass-inset p-3 px-4 mb-6 text-sm ${
            message.kind === "ok" ? "text-emerald-300" : "text-amber-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Parsed transactions */}
      {txns.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Detected transactions</h2>
            <div className="flex gap-2">
              <Button onClick={() => setTxns([])} variant="outline" size="sm">
                <Trash2 className="w-4 h-4 mr-1.5" />
                Clear
              </Button>
              <Button
                onClick={importSelected}
                variant="primary"
                size="sm"
                disabled={
                  importing ||
                  pendingSelectable.filter((t) => t.selected).length === 0
                }
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                )}
                Import selected
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {txns.map((txn) => (
              <div
                key={txn.id}
                className={`glass-inset p-4 flex items-start gap-3 ${
                  txn.status === "imported" ? "opacity-60" : ""
                }`}
              >
                {txn.status === "pending" ? (
                  <input
                    type="checkbox"
                    checked={txn.selected}
                    onChange={() =>
                      setTxns((prev) =>
                        prev.map((t) =>
                          t.id === txn.id ? { ...t, selected: !t.selected } : t,
                        ),
                      )
                    }
                    className="mt-1.5 w-4 h-4 accent-amber-400"
                  />
                ) : (
                  <span className="w-4" />
                )}

                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    txn.direction === "debit"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  {txn.direction === "debit" ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold capitalize truncate">
                      {txn.merchant}
                    </p>
                    <p
                      className={`font-bold ${
                        txn.direction === "debit"
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {txn.direction === "debit" ? "−" : "+"}
                      {currency.symbol}
                      {txn.amount.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(txn.date).toLocaleDateString()}
                    {txn.vpa && <> · {txn.vpa}</>}
                    {txn.ref && <> · Ref {txn.ref}</>}
                  </p>
                  {txn.status === "imported" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                      {txn.direction === "debit"
                        ? "Added to expenses"
                        : "Added to income"}
                    </span>
                  )}
                  {txn.status === "duplicate" && (
                    <span className="text-xs font-medium text-amber-700 mt-1 inline-block">
                      Skipped — already tracked
                    </span>
                  )}
                  {txn.status === "error" && (
                    <span className="text-xs font-medium text-red-300 mt-1 inline-block">
                      Failed to import — try again
                    </span>
                  )}
                  {txn.direction === "credit" && txn.status === "pending" && (
                    <span className="text-xs text-slate-400 mt-1 inline-block">
                      Credit — not imported (expenses track debits only)
                    </span>
                  )}
                </div>

                <button
                  onClick={() =>
                    setTxns((prev) => prev.filter((t) => t.id !== txn.id))
                  }
                  className="text-slate-400 hover:text-red-400 transition-colors"
                  aria-label="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UpiSync;
