# LLM Router — providers and capabilities

Egide's LLM Router (`packages/llm-router`) abstracts every LLM call behind a
single `LLMProvider` interface. This skill documents which providers ship,
their capabilities, and routing recommendations.

See ADR 004 for the architectural decision.

## Provider matrix

| Provider | Hosting | Sovereignty | Caching | Tool use | Streaming | JSON mode | Cost | Notes |
|---|---|---|---|---|---|---|---|---|
| **Anthropic** | US cloud | none | yes (5min TTL) | yes | yes | yes | high | BYOK; best quality for synthesis/judge |
| **Mistral La Plateforme** | FR cloud | EU | partial | yes | yes | yes | medium | BYOK; sovereign FR |
| **Scaleway AI Endpoints** | FR cloud | FR | no | yes | yes | yes | medium | BYOK; sovereign |
| **OVH AI Endpoints** | FR cloud | FR | no | yes | yes | yes | medium | BYOK; sovereign |
| **OpenAI-compatible** | varies | varies | depends | yes | yes | yes | varies | covers Together, Fireworks, Groq, etc |
| **Ollama** | self-hosted | full | no | partial | yes | yes (via grammar) | free | local; quality depends on model |
| **vLLM** | self-hosted | full | no | yes (OpenAI compat) | yes | yes | free + infra | local; high throughput |
| **LM Studio** | self-hosted | full | no | partial | yes | yes (via grammar) | free | desktop; OpenAI-compat API |

## Default routing recommendations

Egide's `LLMRouter` accepts per-task routing config. Sensible defaults:

| Task type | Recommended provider | Why |
|---|---|---|
| `extraction` (parsing PDFs, structuring docs) | Mistral 7B local OR Mistral La Plateforme | Volume; privacy of customer documents |
| `classification` (labeling, framework mapping) | Haiku 4.5 (Anthropic) OR Mistral Small | Cheap, fast |
| `generation` (writing policies, procedures) | Sonnet 4.6 OR Mistral Large | Quality matters |
| `judge` (LLM-as-judge for semantic rules) | Sonnet 4.6 OR Mistral Large | Accuracy critical |
| `synthesis` (full pyramid generation, audit summaries) | Opus 4.7 OR Mistral Large | Top-of-line |

Customers override these per task in their tenant config.

## Configuration shape (per tenant)

```yaml
ai_engine:
  default_provider: ollama
  routes:
    extraction: ollama
    classification: anthropic
    generation: anthropic
    judge: mistral
    synthesis: anthropic
  budget_cap_monthly_usd: 100
  byok:
    anthropic_api_key: "sk-ant-..."   # encrypted at rest
    mistral_api_key: "..."
    scaleway_ai_key: "..."
  local:
    ollama_url: "http://192.168.1.50:11434"
    default_model: "mistral:7b-instruct"
  capability_overrides:
    # If a provider supports caching but customer prefers privacy
    - provider: anthropic
      caching: false
```

## Degraded mode (no AI)

When `EGIDE_AI_MODE=template_only` (Community default):

- `LLMRouter.complete()` throws `AIDisabledError`.
- Calling code MUST catch and fall back to deterministic templates seeded
  from `ontologies/clusters/*.yaml`.
- The validator runs all 25 deterministic rules normally (no LLM judge).
- The compiler runs normally (compilation is rule-based).
- The web UI shows a banner "AI engine is disabled. Pyramid is generated from
  templates. [Enable AI]".

This is non-negotiable for air-gapped Enterprise and for evaluation by
open-source users without a key.

## Audit trail

Every successful or failed call writes a row to `llm_calls`:

- `provider`, `model`, `task_type`
- `input_tokens`, `output_tokens`
- `est_cost_micro_usd` (1e-6 USD precision)
- `latency_ms`
- `success`, `error_code`
- `context_ref` (which artifact was being generated)

This drives:
- Cost dashboards.
- Sovereign provenance reports ("82% of LLM tokens stayed in EU last month").
- Anomaly detection on usage spikes.

## Capability detection

```ts
const router = await getLLMRouter(tenantId);
const provider = router.providerFor("generation");

if (provider.capabilities.caching) {
  // Use cached system prompt
} else {
  // Send full prompt every time
}

if (provider.capabilities.tools) {
  // Use tool-calling protocol
} else {
  // Use JSON-only fallback parsing
}
```

When a feature is unsupported, the calling code degrades gracefully rather
than throwing.

## Provider-specific quirks

- **Anthropic**: cache requires explicit `cache_control` on system blocks.
- **Mistral La Plateforme**: tool use semantics slightly differ from OpenAI;
  use the OpenAI-compat endpoint or the native one.
- **Scaleway / OVH AI**: many endpoints expose Mistral or Llama via
  OpenAI-compat protocol — use the `openai_compat` provider with the right URL.
- **Ollama**: default does NOT have tool use; we prompt-engineer JSON output.
- **vLLM**: best for self-hosting at scale; supports OpenAI-compat with full
  tool use.

## Don'ts

- Don't bypass the router for direct provider calls. Every call must be audited.
- Don't expose customer API keys in logs or LLM prompts.
- Don't assume tool use is available without checking `capabilities.tools`.
- Don't generate prompts larger than 80% of context window — leave headroom.

## Reference paths

- `packages/llm-router/src/types.ts` — interfaces
- `packages/llm-router/src/providers/` — one file per provider
- `packages/llm-router/src/router.ts` — selection + audit logic
- `packages/llm-router/src/edition.ts` — feature gating
- ADR 004 — `docs/adr/004-multi-llm-router.md`

## Versions to track

- Anthropic SDK TS: latest (claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5)
- Mistral SDK / La Plateforme: latest
- Ollama: 0.4+ for tool-use experiments
- vLLM: latest stable
