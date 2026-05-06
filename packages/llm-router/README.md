# @egide/llm-router

Multi-provider LLM router with audit, budget, rate limit, PII scrubbing,
and degraded-mode-without-AI. Implements ADR 004.

## Status

Scaffold. Types, errors, router skeleton, edition gating, PII scrubber,
and 3 provider stubs (Ollama, Anthropic, Mistral) are in place.
Full provider implementations land at M1 sprint S2.

## Usage (after S2)

```ts
import { LLMRouter, OllamaProvider, AnthropicProvider } from "@egide/llm-router";

const router = new LLMRouter({
  tenantConfig: tenant.aiConfig,
  auditSink: async (entry) => db.insert(llmCalls).values(entry),
  rateLimiter: new RedisRateLimiter(redis),
  scrubber: { enabled: true },
});

router.registerProvider(new OllamaProvider({
  baseUrl: "http://localhost:11434",
  defaultModel: "mistral:7b-instruct",
}));
router.registerProvider(new AnthropicProvider({
  apiKey: tenant.aiConfig.byok.anthropic!,
  defaultModel: "claude-sonnet-4-6",
}));

const response = await router.complete("generation", {
  systemPrompt: loadPrompt("compliance/draft_policy.md"),
  messages: [{ role: "user", content: "..." }],
  audit: {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    pyramidId: pyramid.id,
    journeyPhase: "j1.draft_policy",
    workerName: "agents.compliance",
    traceId: ctx.traceId,
  },
});
```

## Threat model

See `docs/threat-models/llm-router.md`.

## Security controls implemented

- LLM01 prompt injection — untrusted content tagging (caller's responsibility)
- LLM02 sensitive info disclosure — PII scrubber + privacy_mode strict
- LLM07 system prompt confidentiality — prompts from disk, never returned
- LLM10 unbounded consumption — rate limit + budget + token caps
- LLM03 supply chain — TLS pinning per provider (provider-specific roots)

## Reference

- ADR 004 — Multi-LLM router
- ADR 014 — OWASP LLM Top 10 mapping
- `docs/threat-models/llm-router.md`
