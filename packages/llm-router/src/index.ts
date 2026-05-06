/**
 * @egide/llm-router — multi-provider LLM router with audit, budget,
 * rate limit, PII scrubbing, and degraded-mode-without-AI.
 *
 * See ADR 004 (multi-LLM router) and ADR 014 §LLM01-LLM10 for security
 * controls. Threat model: docs/threat-models/llm-router.md.
 *
 * Status: scaffold. Provider implementations land at M1 sprint S1-S2.
 */

export type {
  CompleteRequest,
  CompleteResponse,
  Chunk,
  EmbedRequest,
  EmbedResponse,
  LLMProvider,
  ProviderName,
  ProviderCapabilities,
  TaskType,
  RouterConfig,
  TenantAIConfig,
  AuditEntry,
} from "./types.js";

export {
  AIDisabledError,
  BudgetExceededError,
  RateLimitedError,
  ProviderError,
  HallucinationDetectedError,
} from "./errors.js";

export { LLMRouter } from "./router.js";
export { scrubPII } from "./internal/scrubber.js";
export { editionAllows, FEATURE_REQUIREMENTS } from "./edition.js";

export { AnthropicProvider } from "./providers/anthropic.js";
export type { AnthropicConfig } from "./providers/anthropic.js";
export { MistralProvider } from "./providers/mistral.js";
export type { MistralConfig } from "./providers/mistral.js";
export { OllamaProvider } from "./providers/ollama.js";
export type { OllamaConfig } from "./providers/ollama.js";
