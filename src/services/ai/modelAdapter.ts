/**
 * Open-Weight Model Serving Layer Adapter
 * Connects to self-hosted LLM endpoints (Ollama, vLLM, or any OpenAI-compatible engine)
 * Completely eliminates third-party OpenRouter dependency.
 */

export interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface ModelHealth {
  isAvailable: boolean;
  model: string;
  endpoint: string;
  latencyMs?: number;
  lastChecked: number;
  error?: string;
}

export interface ModelMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
}

class ModelAdapter {
  private config: ModelConfig;
  private healthCache: ModelHealth | null = null;
  private metrics: ModelMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatencyMs: 0,
  };

  constructor() {
    this.config = {
      baseUrl:
        import.meta.env.VITE_AI_API_URL ||
        "http://localhost:11434/v1", // Default Ollama local endpoint
      model: import.meta.env.VITE_AI_MODEL || "llama3.2",
      apiKey: import.meta.env.VITE_AI_API_KEY || "ollama",
      timeoutMs: 8000, // 8-second client timeout
    };
  }

  public getConfig(): ModelConfig {
    return { ...this.config };
  }

  public setConfig(custom: Partial<ModelConfig>) {
    this.config = { ...this.config, ...custom };
    this.healthCache = null;
  }

  public getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check to detect if local Ollama or vLLM server is running.
   */
  public async checkHealth(force = false): Promise<ModelHealth> {
    const now = Date.now();
    if (!force && this.healthCache && now - this.healthCache.lastChecked < 15000) {
      return this.healthCache;
    }

    const start = performance.now();
    const endpoint = `${this.config.baseUrl}/models`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Math.round(performance.now() - start);

      if (res.ok) {
        this.healthCache = {
          isAvailable: true,
          model: this.config.model,
          endpoint: this.config.baseUrl,
          latencyMs,
          lastChecked: now,
        };
      } else {
        this.healthCache = {
          isAvailable: false,
          model: this.config.model,
          endpoint: this.config.baseUrl,
          latencyMs,
          lastChecked: now,
          error: `HTTP ${res.status}`,
        };
      }
    } catch (err: any) {
      this.healthCache = {
        isAvailable: false,
        model: this.config.model,
        endpoint: this.config.baseUrl,
        lastChecked: now,
        error: err.name === "AbortError" ? "Connection timeout" : "Service unreachable",
      };
    }

    return this.healthCache;
  }

  /**
   * Send a completion request to the open-weight model with automatic retry.
   */
  public async chatCompletion(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options: { jsonMode?: boolean; temperature?: number } = {}
  ): Promise<string | null> {
    const start = performance.now();
    this.metrics.totalRequests++;

    const payload: Record<string, any> = {
      model: this.config.model,
      messages,
      temperature: options.temperature ?? 0.1,
    };

    if (options.jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const executeAttempt = async (): Promise<string> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Model API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new Error("Empty model response");
        }
        return content;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      // First attempt
      const content = await executeAttempt();
      this.recordSuccess(performance.now() - start);
      return content;
    } catch (firstErr) {
      // Single quick retry with exponential backoff (800ms)
      try {
        await new Promise((r) => setTimeout(r, 800));
        const content = await executeAttempt();
        this.recordSuccess(performance.now() - start);
        return content;
      } catch (retryErr: any) {
        this.metrics.failedRequests++;
        console.warn("Open-weight model request failed:", retryErr.message);
        return null; // Return null so caller falls back to deterministic rule-based engine
      }
    }
  }

  private recordSuccess(latency: number) {
    this.metrics.successfulRequests++;
    this.metrics.averageLatencyMs = Math.round(
      (this.metrics.averageLatencyMs * (this.metrics.successfulRequests - 1) + latency) /
        this.metrics.successfulRequests
    );
  }
}

export const modelAdapter = new ModelAdapter();

