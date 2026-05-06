/**
 * Type definitions for the LLM Router (ADR 004).
 *
 * Every provider implements LLMProvider. The router selects per task,
 * enforces budget/rate limits, scrubs PII, and audits every call.
 */

import type { z } from "zod";

export type ProviderName =
  | "anthropic"
  | "mistral"
  | "scaleway"
  | "ovh"
  | "openai_compat"
  | "ollama"
  | "vllm"
  | "lmstudio";

export type TaskType =
  | "extraction"      // parsing PDFs, structuring documents
  | "classification"  // labeling chunks against frameworks
  | "generation"      // drafting policies, procedures
  | "judge"           // LLM-as-judge for semantic rules
  | "synthesis"       // pyramid synthesis, audit summaries
  | "embedding";      // RAG embeddings

export type Edition = "community" | "professional" | "enterprise";

export interface ProviderCapabilities {
  caching: boolean;       // Anthropic prompt caching
  tools: boolean;         // function/tool calling
  streaming: boolean;
  jsonMode: boolean;      // structured output
  embeddings: boolean;    // exposes embed()
  vision: boolean;        // image input (M5+ feature)
}

export interface CompleteRequest {
  /** System prompt (treated as secret — never returned to client). */
  systemPrompt: string;
  /** Conversation messages. */
  messages: Message[];
  /** Optional tools (function calling). */
  tools?: ToolDefinition[];
  /** Sampling params. */
  temperature?: number;
  maxTokens?: number;
  /** Anthropic prompt caching control. Propagated end-to-end. */
  cacheControl?: "ephemeral" | null;
  /** Validation schema for structured output. */
  responseSchema?: z.ZodType;
  /** Audit context (mandatory). */
  audit: AuditContext;
}

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  /** When role=tool, the tool name. */
  name?: string;
  /** When role=tool, the tool result. */
  toolUseId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  /** Per ADR 011 / 014 §LLM06: every tool declares behavior metadata. */
  metadata: {
    readOnly: boolean;
    requiresApproval: boolean;
    tenantScoped: boolean;
    costClass: "cheap" | "expensive";
  };
}

export interface CompleteResponse {
  content: string;
  toolUses: ToolUse[];
  /** Whether the call hit prompt cache (Anthropic). */
  cacheHit: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Estimated cost in micro-USD (1e-6 USD). */
  estCostMicroUsd: number;
  latencyMs: number;
  finishReason: "stop" | "tool_use" | "length" | "error";
}

export interface ToolUse {
  id: string;
  name: string;
  input: unknown;
}

export interface Chunk {
  type: "text" | "tool_use" | "done";
  delta?: string;
  toolUse?: ToolUse;
}

export interface EmbedRequest {
  texts: string[];
  audit: AuditContext;
}

export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage: { inputTokens: number };
  estCostMicroUsd: number;
  latencyMs: number;
}

/** Mandatory on every call — cf. ADR 014 §A09 audit logging. */
export interface AuditContext {
  tenantId: string;
  actorId?: string;
  pyramidId?: string;
  journeyPhase?: string;     // "j1.classify" | "j3.compile" | ...
  workerName?: string;       // "agents.compliance" | "agents.orchestrator"
  traceId?: string;
}

export interface AuditEntry extends AuditContext {
  provider: ProviderName;
  model: string;
  taskType: TaskType;
  inputTokens: number;
  outputTokens: number;
  estCostMicroUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  success: boolean;
  errorCode?: string;
  contextRef?: string;
  createdAt: Date;
}

export interface LLMProvider {
  readonly name: ProviderName;
  readonly capabilities: ProviderCapabilities;
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  stream(req: CompleteRequest): AsyncIterable<Chunk>;
  embed?(req: EmbedRequest): Promise<EmbedResponse>;
  /** Cost estimate in micro-USD without making a call. */
  costEstimate(req: CompleteRequest): { inputCostMicroUsd: number; outputCostMicroUsd: number };
}

export interface TenantAIConfig {
  edition: Edition;
  /** AI mode — degraded mode is `template_only`. */
  aiMode: "template_only" | "byok" | "local" | "hybrid";
  /** Per ADR 014 §LLM02: when "strict", cloud providers blocked. */
  privacyMode: "standard" | "strict";
  defaultProvider: ProviderName;
  /** Per-task routing override. */
  routes: Partial<Record<TaskType, ProviderName>>;
  /** Encrypted API keys, decrypted just-in-time. */
  byok: Partial<Record<ProviderName, string>>;
  /** Local provider URLs (Ollama, vLLM). */
  local?: {
    ollamaUrl?: string;
    vllmUrl?: string;
    defaultModel?: string;
  };
  /** Embed provider (typically different from completion). */
  embedProvider: ProviderName;
  /** Monthly USD budget cap (in micro-USD for precision). */
  budgetCapMicroUsd: number;
  /** Spent so far this month (in micro-USD). */
  budgetSpentMicroUsd: number;
  /** Per-minute rate limit. */
  rateLimit: {
    completionsPerMinute: number;
    embeddingsPerMinute: number;
  };
}

export interface RouterConfig {
  tenantConfig: TenantAIConfig;
  /** Audit sink — typically writes to llm_calls table. */
  auditSink: (entry: AuditEntry) => Promise<void>;
  /** Rate limit backend (Redis sliding window). */
  rateLimiter: RateLimiter;
  /** PII scrubber config. Disabled when privacy_mode=strict (local-only). */
  scrubber?: { enabled: boolean };
}

export interface RateLimiter {
  /** Returns remaining quota or throws RateLimitedError. */
  consume(tenantId: string, kind: "completion" | "embedding"): Promise<number>;
}
