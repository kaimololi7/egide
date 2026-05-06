/**
 * Typed errors for the LLM Router.
 * Mirror in Python (agents/common/errors.py) and Go (libs/go/llmrouter).
 */

export class LLMRouterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Raised when AI mode is `template_only` and code attempts an LLM call. */
export class AIDisabledError extends LLMRouterError {
  constructor(taskType: string) {
    super(
      "AI_DISABLED",
      `LLM call refused: tenant is in template_only mode (taskType=${taskType})`,
      { taskType },
      false,
    );
  }
}

/** Per-tenant monthly budget exceeded (ADR 014 §LLM10). */
export class BudgetExceededError extends LLMRouterError {
  constructor(
    public readonly capMicroUsd: number,
    public readonly spentMicroUsd: number,
  ) {
    super(
      "BUDGET_EXCEEDED",
      `Monthly LLM budget exceeded: spent ${spentMicroUsd / 1e6}$ of ${capMicroUsd / 1e6}$ cap`,
      { capMicroUsd, spentMicroUsd },
      false,
    );
  }
}

/** Per-tenant rate limit hit (ADR 014 §LLM10). */
export class RateLimitedError extends LLMRouterError {
  constructor(public readonly retryAfterMs: number) {
    super(
      "RATE_LIMITED",
      `LLM rate limit reached. Retry in ${retryAfterMs}ms`,
      { retryAfterMs },
      true,
    );
  }
}

/** Provider returned an error (network, 429, 5xx, etc.). */
export class ProviderError extends LLMRouterError {
  constructor(provider: string, status: number, message: string) {
    super(
      "PROVIDER_ERROR",
      `Provider ${provider} returned ${status}: ${message}`,
      { provider, status },
      status >= 500 || status === 429,
    );
  }
}

/** Output cited an anchor that does not exist in ontology (Q01). */
export class HallucinationDetectedError extends LLMRouterError {
  constructor(public readonly invalidAnchors: string[]) {
    super(
      "HALLUCINATION_DETECTED",
      `LLM output cited unknown anchors: ${invalidAnchors.join(", ")}`,
      { invalidAnchors },
      true,
    );
  }
}

/** Cloud provider call refused due to privacy_mode=strict. */
export class PrivacyModeStrictError extends LLMRouterError {
  constructor(provider: string) {
    super(
      "PRIVACY_MODE_STRICT",
      `Cloud provider ${provider} blocked: tenant privacy_mode=strict (local-only)`,
      { provider },
      false,
    );
  }
}
