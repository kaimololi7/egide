/**
 * Ollama provider (local LLM, sovereign-friendly).
 *
 * Raw HTTP fetch against the Ollama REST API (no SDK).
 * - No API key required.
 * - JSON mode via `format: "json"`.
 * - Tool use via JSON prompt-engineering (Ollama 0.4+ has native support,
 *   but we stay compatible with 0.3 as well).
 * - Embeddings via `/api/embed` (Ollama 0.3+).
 */

import type {
  CompleteRequest,
  CompleteResponse,
  Chunk,
  EmbedRequest,
  EmbedResponse,
  LLMProvider,
  ProviderCapabilities,
  ProviderName,
  ToolUse,
} from "../types.js";
import { ProviderError } from "../errors.js";

export interface OllamaConfig {
  baseUrl: string; // e.g., "http://localhost:11434"
  defaultModel: string; // e.g., "mistral:7b-instruct"
  defaultEmbedModel?: string; // e.g., "nomic-embed-text"
  timeoutMs?: number;
}

// ── Ollama wire types ─────────────────────────────────────────────────
interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  done_reason?: string;
  eval_count?: number;
  prompt_eval_count?: number;
}

interface OllamaChatStreamChunk {
  model: string;
  message: { role: string; content: string };
  done: boolean;
}

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildMessages(req: CompleteRequest): OllamaMessage[] {
  const msgs: OllamaMessage[] = [];
  if (req.systemPrompt) msgs.push({ role: "system", content: req.systemPrompt });
  for (const m of req.messages) {
    msgs.push({ role: m.role === "tool" ? "user" : m.role as "user" | "assistant", content: m.content });
  }
  return msgs;
}

export class OllamaProvider implements LLMProvider {
  readonly name: ProviderName = "ollama";
  readonly capabilities: ProviderCapabilities = {
    caching: false,
    tools: false, // JSON-mode only at MVP; native tool_use added when Ollama 0.4+ is confirmed
    streaming: true,
    jsonMode: true,
    embeddings: true,
    vision: false,
  };

  constructor(private readonly config: OllamaConfig) {}

  private get timeout() {
    return this.config.timeoutMs ?? 120_000;
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: buildMessages(req),
          stream: false,
          format: req.responseSchema ? "json" : undefined,
          options: {
            temperature: req.temperature ?? 0.3,
            num_predict: req.maxTokens ?? 4096,
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new ProviderError("ollama", res.status, errText);
    }

    const data = (await res.json()) as OllamaChatResponse;
    const latencyMs = Date.now() - t0;
    const inputTokens = data.prompt_eval_count ?? 0;
    const outputTokens = data.eval_count ?? 0;

    return {
      content: data.message.content,
      toolUses: [] satisfies ToolUse[],
      cacheHit: false,
      usage: { inputTokens, outputTokens },
      estCostMicroUsd: 0, // local model
      latencyMs,
      finishReason: data.done_reason === "length" ? "length" : "stop",
    };
  }

  async *stream(req: CompleteRequest): AsyncIterable<Chunk> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: buildMessages(req),
          stream: true,
          format: req.responseSchema ? "json" : undefined,
          options: {
            temperature: req.temperature ?? 0.3,
            num_predict: req.maxTokens ?? 4096,
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }

    if (!res.ok) {
      clearTimeout(timer);
      const errText = await res.text();
      throw new ProviderError("ollama", res.status, errText);
    }

    const body = res.body;
    if (!body) {
      clearTimeout(timer);
      throw new ProviderError("ollama", 0, "empty response body");
    }

    try {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let chunk: OllamaChatStreamChunk;
          try { chunk = JSON.parse(trimmed) as OllamaChatStreamChunk; } catch { continue; }
          if (chunk.message?.content) {
            yield { type: "text", delta: chunk.message.content };
          }
          if (chunk.done) {
            yield { type: "done" };
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const t0 = Date.now();
    const model = this.config.defaultEmbedModel ?? this.config.defaultModel;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input: req.texts }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new ProviderError("ollama", res.status, errText);
    }

    const data = (await res.json()) as OllamaEmbedResponse;
    const latencyMs = Date.now() - t0;
    const dims = data.embeddings[0]?.length ?? 0;

    return {
      embeddings: data.embeddings,
      model,
      dimensions: dims,
      usage: { inputTokens: 0 }, // Ollama doesn’t report token count for embeddings
      estCostMicroUsd: 0,
      latencyMs,
    };
  }

  costEstimate(_req: CompleteRequest): {
    inputCostMicroUsd: number;
    outputCostMicroUsd: number;
  } {
    // Local model — no marginal cost.
    return { inputCostMicroUsd: 0, outputCostMicroUsd: 0 };
  }
}
