/**
 * Mistral La Plateforme provider (BYOK sovereign EU cloud).
 *
 * Raw HTTP fetch against Mistral's OpenAI-compatible API (no SDK).
 * - Native tool use (function_call protocol).
 * - Native embedding endpoint (`mistral-embed`, 1024-dim).
 * - Zero-retention option per tenant agreement.
 *
 * Cf. ADR 004 (multi-LLM router), ADR 014 §LLM02 (PII scrub in router).
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

export interface MistralConfig {
  apiKey: string;
  defaultModel: string; // e.g., "mistral-large-2407"
  defaultEmbedModel?: string; // default "mistral-embed"
  baseUrl?: string; // default https://api.mistral.ai
  timeoutMs?: number;
}

const PRICING: Record<string, { input: number; output: number }> = {
  "mistral-large-2407": { input: 2_000_000, output: 6_000_000 },
  "mistral-small-2409": { input: 200_000, output: 600_000 },
  "ministral-8b": { input: 100_000, output: 100_000 },
};

// Embedding cost: $0.10 per 1M tokens = 100_000 micro-USD per million
const EMBED_PRICING_MICRO_USD_PER_M = 100_000;

// \u2500\u2500 OpenAI-compat wire types (Mistral uses this format) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

interface OaiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

interface OaiTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  };
}

interface OaiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OaiResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: OaiToolCall[];
    };
    finish_reason: "stop" | "tool_calls" | "length" | "error" | null;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface OaiStreamChunk {
  choices: Array<{
    delta: { content?: string; tool_calls?: Partial<OaiToolCall>[] };
    finish_reason: string | null;
  }>;
}

interface OaiEmbedResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number };
  model: string;
}

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function buildMessages(req: CompleteRequest): OaiMessage[] {
  const msgs: OaiMessage[] = [];
  if (req.systemPrompt) msgs.push({ role: "system", content: req.systemPrompt });
  for (const m of req.messages) {
    if (m.role === "tool") {
      msgs.push({ role: "tool", content: m.content, tool_call_id: m.toolUseId });
    } else {
      msgs.push({ role: m.role as "user" | "assistant", content: m.content });
    }
  }
  return msgs;
}

function buildTools(req: CompleteRequest): OaiTool[] | undefined {
  if (!req.tools?.length) return undefined;
  return req.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: "object" as const, properties: {}, required: [] },
    },
  }));
}

function mapFinishReason(reason: string | null): CompleteResponse["finishReason"] {
  switch (reason) {
    case "stop": return "stop";
    case "tool_calls": return "tool_use";
    case "length": return "length";
    default: return "stop";
  }
}

export class MistralProvider implements LLMProvider {
  readonly name: ProviderName = "mistral";
  readonly capabilities: ProviderCapabilities = {
    caching: true,
    tools: true,
    streaming: true,
    jsonMode: true,
    embeddings: true,
    vision: false,
  };

  private get baseUrl() {
    return this.config.baseUrl ?? "https://api.mistral.ai";
  }

  private get headers(): Record<string, string> {
    return {
      "authorization": `Bearer ${this.config.apiKey}`,
      "content-type": "application/json",
      "accept": "application/json",
    };
  }

  private get timeout() {
    return this.config.timeoutMs ?? 60_000;
  }

  constructor(private readonly config: MistralConfig) {}

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: buildMessages(req),
          tools: buildTools(req),
          temperature: req.temperature ?? 0.3,
          max_tokens: req.maxTokens ?? 4096,
          response_format: req.responseSchema ? { type: "json_object" } : undefined,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new ProviderError("mistral", res.status, errText);
    }

    const data = (await res.json()) as OaiResponse;
    const latencyMs = Date.now() - t0;
    const choice = data.choices[0];
    const inputTokens = data.usage.prompt_tokens;
    const outputTokens = data.usage.completion_tokens;
    const pricing = PRICING[this.config.defaultModel];
    const estCostMicroUsd = pricing
      ? Math.ceil((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000)
      : 0;

    const toolUses: ToolUse[] = (choice?.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })(),
    }));

    return {
      content: choice?.message.content ?? "",
      toolUses,
      cacheHit: false,
      usage: { inputTokens, outputTokens },
      estCostMicroUsd,
      latencyMs,
      finishReason: mapFinishReason(choice?.finish_reason ?? null),
    };
  }

  async *stream(req: CompleteRequest): AsyncIterable<Chunk> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: buildMessages(req),
          tools: buildTools(req),
          temperature: req.temperature ?? 0.3,
          max_tokens: req.maxTokens ?? 4096,
          stream: true,
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
      throw new ProviderError("mistral", res.status, errText);
    }

    const body = res.body;
    if (!body) {
      clearTimeout(timer);
      throw new ProviderError("mistral", 0, "empty response body");
    }

    try {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Accumulate tool call arguments across partial chunks
      const toolCallAccum: Record<string, { id: string; name: string; args: string }> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { yield { type: "done" }; break; }

          let chunk: OaiStreamChunk;
          try { chunk = JSON.parse(data) as OaiStreamChunk; } catch { continue; }

          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            yield { type: "text", delta: delta.content };
          }

          // Accumulate partial tool call
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = String(tc.id ?? Object.keys(toolCallAccum).length);
              const existing = toolCallAccum[idx];
              if (!existing) {
                toolCallAccum[idx] = {
                  id: tc.id ?? idx,
                  name: tc.function?.name ?? "",
                  args: tc.function?.arguments ?? "",
                };
              } else if (tc.function?.arguments) {
                existing.args += tc.function.arguments;
              }
            }
          }

          if (chunk.choices[0]?.finish_reason === "tool_calls") {
            for (const tc of Object.values(toolCallAccum)) {
              let input: unknown = {};
              try { input = JSON.parse(tc.args); } catch { /* ignore */ }
              yield { type: "tool_use", toolUse: { id: tc.id, name: tc.name, input } };
            }
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
    const model = this.config.defaultEmbedModel ?? "mistral-embed";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ model, input: req.texts, encoding_format: "float" }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new ProviderError("mistral", res.status, errText);
    }

    const data = (await res.json()) as OaiEmbedResponse;
    const latencyMs = Date.now() - t0;
    const inputTokens = data.usage.prompt_tokens;
    const estCostMicroUsd = Math.ceil(
      (inputTokens * EMBED_PRICING_MICRO_USD_PER_M) / 1_000_000,
    );

    return {
      embeddings: data.data.map((d) => d.embedding),
      model: data.model,
      dimensions: data.data[0]?.embedding.length ?? 1024,
      usage: { inputTokens },
      estCostMicroUsd,
      latencyMs,
    };
  }

  costEstimate(req: CompleteRequest): {
    inputCostMicroUsd: number;
    outputCostMicroUsd: number;
  } {
    const pricing = PRICING[this.config.defaultModel];
    if (!pricing) return { inputCostMicroUsd: 0, outputCostMicroUsd: 0 };
    const inputTokens = roughTokenCount(
      req.systemPrompt + req.messages.map((m) => m.content).join("\n"),
    );
    const outputTokens = req.maxTokens ?? 4096;
    return {
      inputCostMicroUsd: Math.ceil((inputTokens * pricing.input) / 1_000_000),
      outputCostMicroUsd: Math.ceil(
        (outputTokens * pricing.output) / 1_000_000,
      ),
    };
  }
}

function roughTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
