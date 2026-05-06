/**
 * LLMRouter — central entry point for every LLM call in Egide.
 *
 * Responsibilities (cf. ADR 004 + 014):
 * 1. Route per task type to the configured provider.
 * 2. Enforce budget cap (LLM10) — refuse over-cap calls.
 * 3. Enforce rate limit (LLM10) — refuse if quota exhausted.
 * 4. Block cloud providers when privacy_mode=strict (LLM02).
 * 5. PII scrub before sending to cloud providers (LLM02).
 * 6. Propagate cache_control headers end-to-end (Anthropic prompt cache).
 * 7. Audit every call (success + failure) to the auditSink.
 * 8. Support degraded mode (template_only) — refuse hard.
 *
 * Status: scaffold. Provider wiring lands at M1 sprint S2.
 */

import type {
  CompleteRequest,
  CompleteResponse,
  EmbedRequest,
  EmbedResponse,
  LLMProvider,
  ProviderName,
  RouterConfig,
  TaskType,
} from "./types.js";
import {
  AIDisabledError,
  BudgetExceededError,
  PrivacyModeStrictError,
  ProviderError,
} from "./errors.js";
import { scrubPII } from "./internal/scrubber.js";

export class LLMRouter {
  private readonly providers = new Map<ProviderName, LLMProvider>();

  constructor(private readonly config: RouterConfig) {}

  /** Register a provider implementation at boot. */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /** Resolve which provider handles a given task type for this tenant. */
  providerFor(taskType: TaskType): LLMProvider {
    const { tenantConfig } = this.config;
    if (tenantConfig.aiMode === "template_only") {
      throw new AIDisabledError(taskType);
    }
    const name =
      tenantConfig.routes[taskType] ?? tenantConfig.defaultProvider;
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ProviderError(name, 0, "provider not registered");
    }
    if (
      tenantConfig.privacyMode === "strict" &&
      isCloudProvider(provider.name)
    ) {
      throw new PrivacyModeStrictError(provider.name);
    }
    return provider;
  }

  async complete(
    taskType: TaskType,
    req: CompleteRequest,
  ): Promise<CompleteResponse> {
    const startedAt = Date.now();
    const provider = this.providerFor(taskType);

    // Pre-flight: budget check.
    const estimate = provider.costEstimate(req);
    const projected =
      this.config.tenantConfig.budgetSpentMicroUsd +
      estimate.inputCostMicroUsd +
      estimate.outputCostMicroUsd;
    if (projected > this.config.tenantConfig.budgetCapMicroUsd) {
      throw new BudgetExceededError(
        this.config.tenantConfig.budgetCapMicroUsd,
        this.config.tenantConfig.budgetSpentMicroUsd,
      );
    }

    // Rate limit consume.
    await this.config.rateLimiter.consume(req.audit.tenantId, "completion");

    // PII scrub when going to cloud providers and scrubber enabled.
    const scrubbedReq =
      this.config.scrubber?.enabled !== false && isCloudProvider(provider.name)
        ? { ...req, messages: req.messages.map((m) => ({ ...m, content: scrubPII(m.content) })) }
        : req;

    let response: CompleteResponse;
    let success = true;
    let errorCode: string | undefined;
    try {
      response = await provider.complete(scrubbedReq);
    } catch (err) {
      success = false;
      errorCode = (err as { code?: string }).code ?? "UNKNOWN";
      // Audit even failures.
      await this.config.auditSink({
        ...req.audit,
        provider: provider.name,
        model: "unknown",
        taskType,
        inputTokens: 0,
        outputTokens: 0,
        estCostMicroUsd: 0,
        latencyMs: Date.now() - startedAt,
        cacheHit: false,
        success: false,
        errorCode,
        createdAt: new Date(),
      });
      throw err;
    }

    await this.config.auditSink({
      ...req.audit,
      provider: provider.name,
      model: "unknown", // populated by provider implementations
      taskType,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      estCostMicroUsd: response.estCostMicroUsd,
      latencyMs: response.latencyMs,
      cacheHit: response.cacheHit,
      success,
      createdAt: new Date(),
    });

    return response;
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const provider = this.providerFor("embedding");
    if (!provider.embed) {
      throw new ProviderError(
        provider.name,
        0,
        "embedding not supported by this provider",
      );
    }
    await this.config.rateLimiter.consume(req.audit.tenantId, "embedding");
    return provider.embed(req);
  }
}

const CLOUD_PROVIDERS: ProviderName[] = [
  "anthropic",
  "mistral",
  "scaleway",
  "ovh",
  "openai_compat",
];

function isCloudProvider(name: ProviderName): boolean {
  return CLOUD_PROVIDERS.includes(name);
}
