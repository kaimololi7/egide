# ADR 004 — Multi-LLM router with degraded-mode-without-AI

- **Status**: Accepted (amended 2026-05-05)
- **Date**: 2026-05-04
- **Deciders**: solo founder
- **Amendments**: see "Updates 2026-05-05" at the bottom

## Context

Customers in the EU regulated mid-market have **divergent LLM constraints**:

| Customer | Constraint | Acceptable LLM source |
|---|---|---|
| Health (HDS) | Data must not leave EU territory | Mistral La Plateforme, Scaleway AI, OVH AI, local Ollama |
| Public sector | No US cloud | EU sovereign or local |
| Industry (SECNUMCLOUD-aligned) | Sovereign by procurement rule | EU or local |
| SaaS company already on AWS | Pragmatic; cloud LLM acceptable | Anthropic, OpenAI |
| Small org with budget cap | Local + free | Ollama on a workstation |
| Air-gapped Enterprise | No internet at all | Local only |

A product that hard-codes a single LLM provider eliminates entire market
segments. A product that hard-codes "needs an LLM" excludes air-gapped users.

## Decision

### LLM Router as a first-class component

Implemented as `packages/llm-router` (TypeScript, in `apps/api`) and consumed
by every service that calls an LLM. Provides a single interface:

```ts
interface LLMProvider {
  name: string;                  // "anthropic" | "mistral" | "scaleway" | "ovh" | "ollama" | "vllm" | "openai-compat"
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  stream(req: CompleteRequest): AsyncIterable<Chunk>;
  embed?(text: string[]): Promise<number[][]>;
  costEstimate(req: CompleteRequest): { inputUsd: number; outputUsd: number };
  capabilities: { caching: boolean; tools: boolean; streaming: boolean; jsonMode: boolean };
}
```

### Supported providers (initial)

1. **Anthropic** (cloud) — BYOK, the tenant's key, never the provider's.
2. **Mistral La Plateforme** (sovereign FR) — BYOK.
3. **Scaleway AI Endpoints** (sovereign FR) — BYOK.
4. **OVH AI Endpoints** (sovereign FR) — BYOK.
5. **OpenAI-compatible** (any URL) — covers Together, Fireworks, etc.
6. **Ollama** (self-hosted) — direct HTTP to `http://host:11434`.
7. **vLLM** (self-hosted) — OpenAI-compatible mode.
8. **LM Studio** (self-hosted) — OpenAI-compatible local API.

### Tenant-level configuration

Each tenant configures **per task type**:

```yaml
ai_engine:
  default_provider: ollama
  routes:
    extraction: ollama         # heavy, runs locally on customer infra
    generation: anthropic       # quality matters, BYOK cloud
    classification: ollama      # cheap, runs locally
    judge: anthropic            # accuracy matters
  byok:
    anthropic_api_key: "sk-ant-..."
    mistral_api_key: "..."
  local:
    ollama_url: "http://192.168.1.50:11434"
    default_model: "mistral:7b-instruct"
```

The router records, per call: provider, model, input tokens, output tokens,
estimated cost, latency, success/failure. Available in the audit trail.

### Degraded mode (no AI)

The Community edition **must** function with `EGIDE_AI_MODE=template_only`.
In this mode:

- Pyramid generation falls back to **deterministic templates** seeded from
  `ontologies/clusters/*.yaml` (the 10 clusters inherited from
  `process-pyramid`).
- Validator runs all 25 deterministic rules normally.
- Policy compiler runs normally (compilation is rule-based, not LLM-based).
- The "drop your docs" J1 journey is **disabled** (text extraction needs an LLM
  for high-quality classification). A clear UI message explains the tradeoff
  and offers manual import.

This guarantees:

- **Air-gapped Enterprise** customers can install with no LLM at all.
- **Open-source** users can evaluate the product without paying for any LLM.
- **AI-down outages** do not break production for existing customers.
- **Demo reliability**: no flaky LLM ruins a sales call.

### Provider capability flags

Some providers support prompt caching (Anthropic, sometimes Mistral), some
support tool use, some don't. The router exposes capabilities so calling code
adapts:

```ts
if (router.current().capabilities.caching) {
  // Use cached system prompt
}
```

When a feature is not supported (e.g., Ollama 7B has no native tool use), the
calling agent falls back to a JSON-only protocol parsed manually.

### Cost and budget control

Each tenant has a monthly budget cap (configurable). The router rejects calls
that would exceed the cap and surfaces a clear UI warning with options
(switch to local, increase cap, batch later).

## Consequences

- The router is built **before** the first agent that uses it. Premature
  abstraction is a real risk; we accept it because the cost of retrofitting
  is higher than the cost of building it once and reusing.
- Adding a new provider is a one-file change: implement `LLMProvider`,
  register in the factory.
- Capability differences between providers leak into agent code (if/else
  on caching, tool use). We accept this; the alternative (lowest common
  denominator) cripples the product.
- The audit trail must store per-call metadata even for local Ollama calls
  (governance requirement: every LLM action is traceable, see ADR 001).
- For Enterprise air-gapped, we ship a **pre-quantified Mistral 7B / Qwen 14B**
  in the install bundle so the customer has a working LLM out of the box.

## Updates 2026-05-05

### Prompt caching propagation

Anthropic prompt caching (5-minute TTL) requires `cache_control` headers on
specific system blocks. A naive proxy implementation would strip them ; we
must propagate. The router preserves all caching-related headers and metadata
end-to-end. For non-Anthropic providers (no caching), `cache_control` is a
no-op.

### Embedding endpoint

The `LLMProvider` interface is extended with an optional `embed()` method
(was already noted but not specified). Used by ADR 007 (RAG normative).
Providers that do not natively support embeddings (Anthropic) declare
`capabilities.embeddings = false` ; the calling code routes embed calls to
a fallback provider configured per tenant (`ai_engine.embed_provider`).

### Audit trail enrichment

The `llm_calls` table is extended (next Drizzle migration) with:

- `pyramid_id` — which pyramid was being worked on
- `journey_phase` — `j1.classify` / `j1.draft_policy` / `j3.compile` / etc.
- `worker_name` — `agents.compliance` / `agents.orchestrator`
- `cache_hit` boolean — was the call served from prompt cache

These columns drive cost-attribution, performance investigation, and
per-tenant billing analytics.

### LLM Top 10 controls (cf. ADR 014)

The router enforces multiple OWASP LLM Top 10 (2025) controls at the
gateway layer:

- **LLM01 Prompt injection**: untrusted content (documents, tool
  results coming from external systems) is wrapped in
  `<untrusted_content>` tags and the system prompt instructs the model
  not to follow instructions inside.
- **LLM02 Sensitive info disclosure**: PII scrubber runs pre-prompt
  for cloud providers (placeholders for emails, IPs, secret-like
  patterns) ; bypass only when the tenant routes to local providers
  in `privacy_mode: strict`.
- **LLM07 System prompt confidentiality**: prompts are loaded from
  `prompts/<worker>/<version>.md` at boot and treated as secrets ;
  never returned in API responses ; output scrubber strips
  prompt-fragment leakage.
- **LLM10 Unbounded consumption**: per-tenant rate limit (60 LLM
  calls/min, 1000 embed calls/min default), per-call token caps
  (input ≤100K, output ≤16K), monthly USD budget cap, cost spike
  alert (>3× rolling 7-day average).

Each control is implemented in `packages/llm-router/` and tested with
adversarial fixtures in the eval suite (ADR 009).

### Embed model defaults

Per ADR 007:

| Mode | Embed default |
|---|---|
| Sovereign cloud / Pro+ | `mistral-embed` (1024-dim) |
| Local / air-gapped / Community | `nomic-embed-text` via Ollama (768-dim) |
| Anthropic-primary tenant | Voyage `voyage-3` if available, else nomic |

### Agent framework dependency

Adopted in Python AI workers: **PydanticAI + Instructor** (see ADR 011).
The router is consumed via a thin `LLMClient` adapter in `agents/common/`
that calls the router over HTTP from `apps/api` ; for high-throughput
embed batches it reads from NATS subject `egide.llm.embed.requests`
(streaming response).
