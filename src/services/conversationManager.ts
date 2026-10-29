import { parseUserMessage, ParseResult } from "./ai/ruleBasedParser";
import { modelAdapter } from "./ai/modelAdapter";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  TransactionDraft,
  TransactionRecord,
} from "./transactionService";
import {
  getFinancialSummary,
  compareWithLastMonth,
  getCategorySpend,
} from "./financialQueryService";
import { parseDateRange, formatFriendlyDate } from "./dateService";

export interface ConversationTurn {
  id: string;
  sender: "user" | "penny";
  text: string;
  timestamp: string;
  transaction?: TransactionRecord;
  statusBadge?: "recorded" | "updated" | "deleted" | "query" | "clarification";
}

export interface ConversationState {
  turns: ConversationTurn[];
  pendingDraft: Partial<TransactionDraft> | null;
  isAwaitingAmount: boolean;
  isAwaitingDescription: boolean;
  lastCreatedTransaction: TransactionRecord | null;
  modelStatus: "connected" | "offline_fallback";
}

export interface ProcessMessageResult {
  reply: string;
  recordedTransaction?: TransactionRecord;
  updatedTransaction?: TransactionRecord;
  deletedTransactionId?: string;
  isAwaitingInput?: boolean;
  modelStatus: "connected" | "offline_fallback";
}

class ConversationManager {
  private state: ConversationState = {
    turns: [],
    pendingDraft: null,
    isAwaitingAmount: false,
    isAwaitingDescription: false,
    lastCreatedTransaction: null,
    modelStatus: "offline_fallback",
  };

  public getState(): ConversationState {
    return { ...this.state };
  }

  public resetState() {
    this.state = {
      turns: [],
      pendingDraft: null,
      isAwaitingAmount: false,
      isAwaitingDescription: false,
      lastCreatedTransaction: null,
      modelStatus: "offline_fallback",
    };
  }

  /**
   * Process a message from the authenticated user.
   */
  public async handleMessage(
    userMessage: string,
    userId: string,
    currencySymbol: string = "₹",
    referenceDate: Date = new Date()
  ): Promise<ProcessMessageResult> {
    const trimmed = userMessage.trim();
    if (!trimmed) {
      return {
        reply: "Please enter a message or question.",
        modelStatus: this.state.modelStatus,
      };
    }

    // 1. Check open-weight model health
    const health = await modelAdapter.checkHealth();
    this.state.modelStatus = health.isAvailable ? "connected" : "offline_fallback";

    // 2. Determine intent and extracted fields using rule-based parser or hybrid model
    let parsed: ParseResult = parseUserMessage(trimmed, referenceDate, {
      isAwaitingAmount: this.state.isAwaitingAmount,
      isAwaitingDescription: this.state.isAwaitingDescription,
      pendingDraft: this.state.pendingDraft || undefined,
      lastCreatedTransactionId: this.state.lastCreatedTransaction?.id,
    });

    // 3. Process Intent
    switch (parsed.intent) {
      // ----------------------------------------------------------------------
      // Clarification Answer (Resolving pending draft)
      // ----------------------------------------------------------------------
      case "clarification_answer": {
        if (!this.state.pendingDraft) {
          return {
            reply: "I wasn't sure what that was referring to. Could you tell me what you spent or received?",
            modelStatus: this.state.modelStatus,
          };
        }

        const mergedDraft: TransactionDraft = {
          type: this.state.pendingDraft.type || "expense",
          amount: parsed.amount ?? this.state.pendingDraft.amount ?? null,
          currency: this.state.pendingDraft.currency || "INR",
          description: parsed.description ?? this.state.pendingDraft.description ?? null,
          category: parsed.category ?? this.state.pendingDraft.category ?? null,
          transactionDate:
            this.state.pendingDraft.transactionDate ||
            new Date(referenceDate).toISOString().split("T")[0],
          confidence: 0.95,
          missingFields: [],
          requiresConfirmation: false,
        };

        // Check if amount is still missing
        if (mergedDraft.amount === null) {
          this.state.isAwaitingAmount = true;
          this.state.pendingDraft = mergedDraft;
          return {
            reply: `Got it. How much did you ${mergedDraft.type === "income" ? "receive" : "spend"}?`,
            isAwaitingInput: true,
            modelStatus: this.state.modelStatus,
          };
        }

        // Check if description is missing for an expense
        if (!mergedDraft.description && mergedDraft.type === "expense") {
          this.state.isAwaitingDescription = true;
          this.state.pendingDraft = mergedDraft;
          return {
            reply: `Sure! What was the ${currencySymbol}${mergedDraft.amount} for?`,
            isAwaitingInput: true,
            modelStatus: this.state.modelStatus,
          };
        }

        // Complete! Persist to Supabase
        const idempotencyKey = `penny_${userId}_${Date.now()}`;
        const saveRes = await createTransaction(mergedDraft, userId, idempotencyKey);

        if (!saveRes.success || !saveRes.record) {
          return {
            reply: `I encountered an issue saving your transaction: ${saveRes.error}. Please try again.`,
            modelStatus: this.state.modelStatus,
          };
        }

        // Clear pending draft and save as last transaction
        this.state.pendingDraft = null;
        this.state.isAwaitingAmount = false;
        this.state.isAwaitingDescription = false;
        this.state.lastCreatedTransaction = saveRes.record;

        const friendlyDate = formatFriendlyDate(saveRes.record.date, referenceDate);
        const reply =
          saveRes.record.type === "income"
            ? `Done! I've recorded your ${currencySymbol}${saveRes.record.amount.toLocaleString()} ${saveRes.record.description} for ${friendlyDate} under Income, tagged as ${saveRes.record.category}.`
            : `Done! I've recorded ${currencySymbol}${saveRes.record.amount.toLocaleString()} for ${saveRes.record.description} on ${friendlyDate} under ${saveRes.record.category}.`;

        return {
          reply,
          recordedTransaction: saveRes.record,
          modelStatus: this.state.modelStatus,
        };
      }

      // ----------------------------------------------------------------------
      // Record Transaction
      // ----------------------------------------------------------------------
      case "record_transaction": {
        const draft = parsed.draft;

        // If amount is missing: ask for amount
        if (draft.amount === null) {
          this.state.pendingDraft = draft;
          this.state.isAwaitingAmount = true;
          this.state.isAwaitingDescription = false;
          const prompt =
            draft.type === "income"
              ? `That's great! How much ${draft.description?.toLowerCase() || "salary"} did you receive?`
              : "Sure! How much did you spend?";
          return {
            reply: prompt,
            isAwaitingInput: true,
            modelStatus: this.state.modelStatus,
          };
        }

        // If description is missing on expense: ask for description
        if (!draft.description && draft.type === "expense") {
          this.state.pendingDraft = draft;
          this.state.isAwaitingAmount = false;
          this.state.isAwaitingDescription = true;
          return {
            reply: `Sure! What was the ${currencySymbol}${draft.amount} for?`,
            isAwaitingInput: true,
            modelStatus: this.state.modelStatus,
          };
        }

        // Complete transaction! Persist directly
        const idempotencyKey = `penny_${userId}_${draft.type}_${draft.amount}_${draft.transactionDate}_${draft.description}`;
        const saveRes = await createTransaction(draft, userId, idempotencyKey);

        if (!saveRes.success || !saveRes.record) {
          return {
            reply: `I couldn't record that transaction: ${saveRes.error}. Please check the details.`,
            modelStatus: this.state.modelStatus,
          };
        }

        this.state.pendingDraft = null;
        this.state.isAwaitingAmount = false;
        this.state.isAwaitingDescription = false;
        this.state.lastCreatedTransaction = saveRes.record;

        const friendlyDate = formatFriendlyDate(saveRes.record.date, referenceDate);
        const reply =
          saveRes.record.type === "income"
            ? `Done! I've recorded your ${currencySymbol}${saveRes.record.amount.toLocaleString()} ${saveRes.record.description} for ${friendlyDate} under Income, tagged as ${saveRes.record.category}.`
            : `Done! I've recorded ${currencySymbol}${saveRes.record.amount.toLocaleString()} for ${saveRes.record.description} on ${friendlyDate} under ${saveRes.record.category}.`;

        return {
          reply,
          recordedTransaction: saveRes.record,
          modelStatus: this.state.modelStatus,
        };
      }

      // ----------------------------------------------------------------------
      // Correction ("Actually, it was ₹900", "That was two days ago, not yesterday")
      // ----------------------------------------------------------------------
      case "correction": {
        if (!this.state.lastCreatedTransaction) {
          return {
            reply: "I don't have a recent transaction to update. Which transaction would you like to edit?",
            modelStatus: this.state.modelStatus,
          };
        }

        const target = this.state.lastCreatedTransaction;
        const updates: any = {};
        updates[parsed.field] = parsed.value;

        const updateRes = await updateTransaction(
          userId,
          target.id,
          target.type,
          updates
        );

        if (!updateRes.success || !updateRes.record) {
          return {
            reply: `Failed to update transaction: ${updateRes.error}`,
            modelStatus: this.state.modelStatus,
          };
        }

        this.state.lastCreatedTransaction = updateRes.record;

        let confirmationText = "";
        if (parsed.field === "amount") {
          confirmationText = `Got it! I've updated the ${target.description} transaction amount to ${currencySymbol}${parsed.value.toLocaleString()}.`;
        } else if (parsed.field === "date") {
          const friendly = formatFriendlyDate(parsed.value, referenceDate);
          confirmationText = `Done! I've updated the date to ${friendly}.`;
        } else if (parsed.field === "category") {
          confirmationText = `Updated! The category is now set to ${parsed.value}.`;
        } else {
          confirmationText = `Updated! Description is now ${parsed.value}.`;
        }

        return {
          reply: confirmationText,
          updatedTransaction: updateRes.record,
          modelStatus: this.state.modelStatus,
        };
      }

      // ----------------------------------------------------------------------
      // Deletion ("Delete the transaction I just added")
      // ----------------------------------------------------------------------
      case "deletion": {
        if (!this.state.lastCreatedTransaction) {
          return {
            reply: "There are no recently added transactions in this session to delete.",
            modelStatus: this.state.modelStatus,
          };
        }

        const target = this.state.lastCreatedTransaction;
        const delRes = await deleteTransaction(userId, target.id, target.type);

        if (!delRes.success) {
          return {
            reply: `Could not delete transaction: ${delRes.error}`,
            modelStatus: this.state.modelStatus,
          };
        }

        this.state.lastCreatedTransaction = null;
        return {
          reply: `Done! I've deleted the ${currencySymbol}${target.amount.toLocaleString()} ${target.description} transaction.`,
          deletedTransactionId: target.id,
          modelStatus: this.state.modelStatus,
        };
      }

      // ----------------------------------------------------------------------
      // Financial Queries (Deterministic Calculations)
      // ----------------------------------------------------------------------
      case "financial_query": {
        const range = parseDateRange(parsed.datePhrase, referenceDate);

        // A. Period Comparison (e.g. Compare with last month)
        if (parsed.queryType === "compare_month") {
          const comp = await compareWithLastMonth(userId, referenceDate);
          const dirWord = comp.increased ? "higher" : "lower";
          const emoji = comp.increased ? "📈" : "📉";
          const reply = `${emoji} **Monthly Comparison**:\nYou've spent **${currencySymbol}${comp.currentExpense.toLocaleString()}** this month compared to **${currencySymbol}${comp.previousExpense.toLocaleString()}** last month (a **${comp.percentageChange}% ${dirWord}** spend). ${
            comp.increased
              ? "Look out for non-essential spending!"
              : "Great job keeping expenses down!"
          }`;
          return { reply, modelStatus: this.state.modelStatus };
        }

        // B. Biggest Expense Category
        if (parsed.queryType === "biggest_category") {
          const summary = await getFinancialSummary(userId, range);
          if (!summary.biggestCategory) {
            return {
              reply: `You haven't recorded any expenses for ${range.label.toLowerCase()} yet!`,
              modelStatus: this.state.modelStatus,
            };
          }
          const reply = `🏆 Your biggest expense category for ${range.label.toLowerCase()} is **${
            summary.biggestCategory.category
          }** at **${currencySymbol}${summary.biggestCategory.amount.toLocaleString()}** (${
            summary.biggestCategory.percentage
          }% of your total expenses).`;
          return { reply, modelStatus: this.state.modelStatus };
        }

        // C. Specific Category Spend (e.g. food, shopping)
        if (parsed.queryType === "category_spend" && parsed.categoryFilter) {
          const catData = await getCategorySpend(userId, parsed.categoryFilter, range);
          const reply = `🍽️ You've spent **${currencySymbol}${catData.totalSpent.toLocaleString()}** on ${catData.matchedCategory} ${range.label.toLowerCase()} across ${catData.transactions.length} transaction${catData.transactions.length === 1 ? "" : "s"}.`;
          return { reply, modelStatus: this.state.modelStatus };
        }

        // D. General Spend Query
        if (parsed.queryType === "spend_total") {
          const summary = await getFinancialSummary(userId, range);
          const reply = `💸 You have spent **${currencySymbol}${summary.totalExpenses.toLocaleString()}** ${range.label.toLowerCase()} (${summary.expenseCount} transaction${summary.expenseCount === 1 ? "" : "s"}).`;
          return { reply, modelStatus: this.state.modelStatus };
        }

        // E. Income Query
        if (parsed.queryType === "income_total") {
          const summary = await getFinancialSummary(userId, range);
          const reply = `💰 You have received **${currencySymbol}${summary.totalIncome.toLocaleString()}** in income ${range.label.toLowerCase()}.`;
          return { reply, modelStatus: this.state.modelStatus };
        }

        // F. Savings / Net Cash Flow
        if (parsed.queryType === "savings") {
          const summary = await getFinancialSummary(userId, range);
          const surplus = summary.netCashFlow >= 0;
          const reply = `📊 For ${range.label.toLowerCase()}:\n- Total Income: **${currencySymbol}${summary.totalIncome.toLocaleString()}**\n- Total Expenses: **${currencySymbol}${summary.totalExpenses.toLocaleString()}**\n- Net ${surplus ? "Surplus" : "Deficit"}: **${currencySymbol}${Math.abs(summary.netCashFlow).toLocaleString()}** (${summary.savingsRate}% savings rate).`;
          return { reply, modelStatus: this.state.modelStatus };
        }

        return {
          reply: `I checked your finances for ${range.label}: let me know if you want expenses, income, or category breakdown!`,
          modelStatus: this.state.modelStatus,
        };
      }

      // ----------------------------------------------------------------------
      // General Chat / Fallback
      // ----------------------------------------------------------------------
      default: {
        return {
          reply:
            parsed.response ||
            "I'm Penny, your personal finance assistant! You can say things like 'I spent ₹450 on dinner yesterday', 'I got my salary today', or 'How much did I spend this month?'.",
          modelStatus: this.state.modelStatus,
        };
      }
    }
  }
}

export const conversationManager = new ConversationManager();
