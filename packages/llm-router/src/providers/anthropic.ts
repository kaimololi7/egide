/**
 * Anthropic provider (BYOK cloud).
 *
 * Raw HTTP fetch — no Anthropic SDK (cf. ADR 004, no vendor lock-in).
 * - Native tool use (JSON tool_use blocks).
 * - Native prompt caching (5-minute TTL via cache_control headers).
 * - No first-party embedding endpoint — router falls back to Ollama/Mistral.
 *
 * Cf. ADR 014 §LLM02 (PII scrub before send happens in LLMRouter, not here).
 */

import type {
  CompleteRequest,
  CompleteResponse,
  Chunk,
  LLMProvider,
  ProviderCapabilities,
  ProviderName,
  ToolUse,
} from "../types.js";
import { ProviderError } from "../errors.js";

export interface AnthropicConfig {
  apiKey: string; // tenant BYOK, decrypted just-in-time
  defaultModel: string; // e.g., "claude-sonnet-4-6"
  baseUrl?: string; // default https://api.anthropic.com
  timeoutMs?: number;
}

// Pricing per million tokens, in micro-USD.
// Source: Anthropic pricing as of 2026 (update via Renovate or manual).
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 15_000_000, output: 75_000_000 },
  "claude-sonnet-4-6": { input: 3_000_000, output: 15_000_000 },
  "claude-haiku-4-5": { input: 800_000, output: 4_000_000 },
};

// ── Anthropic wire types ───────────────────────────────────────────────
interface AnthropicMessage {
  role: "user" | "assistant";
  content:
    | string
    | Array<{
        type: "text" | "tool_result" | "tool_use";
        text?: string;
        tool_use_id?: string;
        content?: string;
        id?: string;
        name?: string;
        input?: unknown;
        cache_control?: { type: "ephemeral" };
      }>;
}

interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{
    type: "text" | "tool_use";
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: { type: string; text?: string; partial_json?: string };
  content_block?: { type: string; text?: string; id?: string; name?: string };
  message?: { usage?: AnthropicResponse["usage"]; stop_reason?: string };
  usage?: { output_tokens?: number };
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildMessages(req: CompleteRequest): AnthropicMessage[] {
  return req.messages.map((m, idx): AnthropicMessage => {
    const isLast = idx === req.messages.length - 1;
    if (m.role === "tool") {
      return {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: m.toolUseId ?? "",
          content: m.content,
        }],
      };
    }
    // Add cache_control to last user message when requested.
    const cacheBlock =
      isLast && req.cacheControl === "ephemeral"
        ? [{ type: "text" as const, text: m.content, cache_control: { type: "ephemeral" as const } }]
        : undefined;
    return {
      role: m.role as "user" | "assistant",
      content: cacheBlock ?? m.content,
    };
  });
}

function buildTools(req: CompleteRequest): AnthropicToolDef[] | undefined {
  if (!req.tools?.length) return undefined;
  return req.tools.map((t) => ({
    name: t.name,
    description: t.description,
    // Zod schema → JSON Schema is non-trivial without zodToJsonSchema.
    // Emit a permissive schema here; validation happens server-side.
    input_schema: { type: "object" as const, properties: {}, required: [] },
  }));
}

function mapStopReason(
  reason: AnthropicResponse["stop_reason"],
): CompleteResponse["finishReason"] {
  switch (reason) {
    case "end_turn": return "stop";
    case "tool_use": return "tool_use";
    case "max_tokens": return "length";
    default: return "stop";
  }
}

function parseUsage(usage: AnthropicResponse["usage"], model: string): {
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
  estCostMicroUsd: number;
} {
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheHit = cacheRead > 0;
  const pricing = PRICING[model];
  const estCostMicroUsd = pricing
    ? Math.ceil((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000)
    : 0;
  return { inputTokens, outputTokens, cacheHit, estCostMicroUsd };
}

function buildRequestBody(req: CompleteRequest, model: string, stream: boolean) {
  return {
    model,
    system: req.systemPrompt || undefined,
    messages: buildMessages(req),
    tools: buildTools(req),
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature ?? 0.3,
    stream,
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly name: ProviderName = "anthropic";
  readonly capabilities: ProviderCapabilities = {
    caching: true,
    tools: true,
    streaming: true,
    jsonMode: true,
    embeddings: false,
    vision: true,
  };

  private get baseUrl() {
    return this.config.baseUrl ?? "https://api.anthropic.com";
  }

  private get headers(): Record<string, string> {
    return {
      "x-api-key": this.config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    };
  }

  constructor(private readonly config: AnthropicConfig) {}

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 60_000,
    );

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(buildRequestBody(req, this.config.defaultModel, false)),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new ProviderError("anthropic", res.status, errText);
    }

    const data = (await res.json()) as AnthropicResponse;
    const latencyMs = Date.now() - t0;
    const { inputTokens, outputTokens, cacheHit, estCostMicroUsd } = parseUsage(
      data.usage,
      this.config.defaultModel,
    );

    const textContent = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    const toolUses: ToolUse[] = data.content
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ id: b.id ?? "", name: b.name ?? "", input: b.input }));

    return {
      content: textContent,
      toolUses,
      cacheHit,
      usage: { inputTokens, outputTokens },
      estCostMicroUsd,
      latencyMs,
      finishReason: mapStopReason(data.stop_reason),
    };
  }

  async *stream(req: CompleteRequest): AsyncIterable<Chunk> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 120_000,
    );

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(buildRequestBody(req, this.config.defaultModel, true)),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }

    if (!res.ok) {
      clearTimeout(timer);
      const errText = await res.text();
      throw new ProviderError("anthropic", res.status, errText);
    }

    const body = res.body;
    if (!body) {
      clearTimeout(timer);
      throw new ProviderError("anthropic", 0, "empty response body");
    }

    try {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentToolId = "";
      let currentToolName = "";
      let toolInputJson = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          let event: AnthropicStreamEvent;
          try {
            event = JSON.parse(data) as AnthropicStreamEvent;
          } catch {
            continue;
          }

          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            currentToolId = event.content_block.id ?? "";
            currentToolName = event.content_block.name ?? "";
            toolInputJson = "";
          } else if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta") {
              yield { type: "text", delta: event.delta.text ?? "" };
            } else if (event.delta?.type === "input_json_delta") {
              toolInputJson += event.delta.partial_json ?? "";
            }
          } else if (event.type === "content_block_stop" && currentToolId) {
            let parsedInput: unknown = {};
            try { parsedInput = JSON.parse(toolInputJson); } catch { /* ignore */ }
            yield {
              type: "tool_use",
              toolUse: { id: currentToolId, name: currentToolName, input: parsedInput },
            };
            currentToolId = "";
            currentToolName = "";
            toolInputJson = "";
          } else if (event.type === "message_stop") {
            yield { type: "done" };
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
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

/** Rough heuristic: 4 characters ≈ 1 token. Replace with tiktoken-equivalent later. */
function roughTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
