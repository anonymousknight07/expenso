import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("../src/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from "../src/lib/supabase";
import { modelAdapter } from "../src/services/ai/modelAdapter";
import { conversationManager } from "../src/services/conversationManager";
import * as txService from "../src/services/transactionService";

describe("AI Resilience & Offline Fallback", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const refDate = new Date(2026, 9, 29);

  beforeEach(() => {
    conversationManager.resetState();
    vi.restoreAllMocks();
  });

  it("ensures no dependency on OpenRouter in modelAdapter configuration", () => {
    const config = modelAdapter.getConfig();
    expect(config.baseUrl).not.toContain("openrouter.ai");
    expect(config.baseUrl).toBeDefined();
    expect(config.model).not.toContain("openrouter");
  });

  it("gracefully falls back to deterministic rule engine when model server is unreachable", async () => {
    // Mock health check failing (server offline)
    vi.spyOn(modelAdapter, "checkHealth").mockResolvedValue({
      isAvailable: false,
      model: "llama3.2",
      endpoint: "http://localhost:11434/v1",
      lastChecked: Date.now(),
      error: "Service unreachable",
    });

    vi.spyOn(txService, "createTransaction").mockResolvedValue({
      success: true,
      record: {
        id: "offline-tx-1",
        type: "expense",
        amount: 450,
        description: "dinner",
        category: "Food & Dining",
        date: "2026-10-28",
      },
    });

    // Send transaction when model server is completely offline
    const res = await conversationManager.handleMessage(
      "I spent ₹450 on dinner yesterday",
      userId,
      "₹",
      refDate
    );

    // Should still successfully process and persist through deterministic rule-engine
    expect(res.modelStatus).toBe("offline_fallback");
    expect(res.recordedTransaction?.amount).toBe(450);
    expect(res.reply).toContain("Done! I've recorded ₹450 for dinner on Yesterday under Food & Dining.");
  });

  it("handles model timeouts gracefully without falsely claiming success", async () => {
    // Mock model request timing out / returning null
    vi.spyOn(modelAdapter, "chatCompletion").mockResolvedValue(null);

    // If user asks a question while model times out
    const res = await conversationManager.handleMessage(
      "Hello Penny, tell me a joke about money",
      userId,
      "₹",
      refDate
    );

    // Should not crash or claim a transaction was saved
    expect(res.recordedTransaction).toBeUndefined();
    expect(res.reply).toBeDefined();
  });

  it("rejects invalid transaction drafts (missing amount, negative numbers)", () => {
    const invalidDraft1 = {
      type: "expense" as const,
      amount: -100, // Negative amount
      currency: "INR",
      description: "Test",
      category: "General",
      transactionDate: "2026-10-29",
      confidence: 1.0,
      missingFields: [],
      requiresConfirmation: false,
    };

    const res1 = txService.validateTransactionDraft(invalidDraft1);
    expect(res1.isValid).toBe(false);
    expect(res1.errors[0]).toContain("valid positive amount");

    const invalidDraft2 = {
      type: "expense" as const,
      amount: null, // Null amount
      currency: "INR",
      description: "Test",
      category: "General",
      transactionDate: "2026-10-29",
      confidence: 1.0,
      missingFields: [],
      requiresConfirmation: false,
    };

    const res2 = txService.validateTransactionDraft(invalidDraft2);
    expect(res2.isValid).toBe(false);
  });

  it("prevents duplicate transactions using idempotency keys", async () => {
    // Setup Supabase mock for creation
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "expense_categories") {
        return {
          select: () => ({
            eq: () => ({
              ilike: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: "cat-1", name: "Food & Dining" }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "expenses") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "tx-mock-123",
                    amount: 350,
                    description: "Lunch",
                    date: "2026-10-29",
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "expense_category_mappings") {
        return {
          insert: () => Promise.resolve({ data: null, error: null }),
        };
      }
      if (table === "budgets") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    });

    const validDraft: txService.TransactionDraft = {
      type: "expense",
      amount: 350,
      currency: "INR",
      description: "Lunch",
      category: "Food & Dining",
      transactionDate: "2026-10-29",
      confidence: 1.0,
      missingFields: [],
      requiresConfirmation: false,
    };

    const key = `idempotent_test_key_${Date.now()}`;

    // First attempt creates and caches
    const res1 = await txService.createTransaction(validDraft, userId, key);
    expect(res1.success).toBe(true);
    expect(res1.record?.id).toBe("tx-mock-123");

    // Immediate retry with identical idempotency key returns cached record without writing again
    const res2 = await txService.createTransaction(validDraft, userId, key);
    expect(res2.success).toBe(true);
    expect(res2.record?.id).toBe(res1.record?.id);
  });
});
