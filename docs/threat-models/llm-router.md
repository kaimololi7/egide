# Threat model — LLM Router (`packages/llm-router`)

- **Status**: Live
- **Date**: 2026-05-05
- **Reviewer**: solo founder
- **Related ADRs**: 004 (multi-LLM router), 014 (OWASP LLM Top 10)
- **Component(s)**: `packages/llm-router` consumed by `apps/api` and
  `agents/common` via HTTP/NATS

## 1. Assets

| Asset | Sensitivity |
|---|---|
| Per-tenant LLM API keys (BYOK) | critical |
| System prompts (per AI worker) | high |
| LLM call audit log | high |
| Per-tenant budget (financial impact) | high |
| Customer document content sent to LLM | high |

## 2. Trust boundaries

```
[ AI worker (Python) ] ─HTTP/NATS─▶ [ apps/api ]
                                          │
                                          ▼
                            ┌── packages/llm-router ──┐
                            │ - PII scrubber          │
                            │ - rate limit            │
                            │ - budget check          │
                            │ - cache_control prop.   │
                            │ - audit log             │
                            └────────────┬────────────┘
                                         │ HTTPS pinned roots
                                         ▼
                                ┌──────────────┐
                                │  Provider    │  Anthropic / Mistral /
                                │  (untrusted) │  Scaleway / OVH / Ollama / vLLM
                                └──────────────┘
```

Untrusted: provider response (could attempt prompt injection of the
caller via response).
Trusted: system prompts, tenant config (after auth), audit metadata.

## 3. STRIDE threats

### Spoofing
- **Provider impersonation** (DNS hijack, MITM).
  - Mitigation: TLS 1.3 with cert pinning at provider's published roots
    ; HSTS for cloud providers.

### Tampering
- **Provider returns adversarial output** designed to manipulate caller.
  - Mitigation: every output Pydantic-validated ; scrubber strips
    suspicious patterns (HTML script tags, prompt injection markers) ;
    tool calls follow whitelist (cf. ADR 011).

### Repudiation
- **Customer disputes a charge**.
  - Mitigation: `llm_calls` row per call with provider, model, tokens,
    cost, latency, timestamp, tenant_id, actor_id, pyramid_id,
    journey_phase, worker_name, cache_hit. Append-only.

### Information disclosure
- **System prompt leakage in response** (LLM07).
  - Mitigation: prompts treated as secrets ; loaded from
    `prompts/<worker>/<version>.md` at boot ; never returned in API
    responses ; output scrubber strips lines starting with `<system>`,
    `<instructions>`, etc.
- **PII sent to cloud provider** (LLM02).
  - Mitigation: PII scrubber pre-prompt (emails, IPs, secret patterns
    replaced with placeholders) for cloud providers ; bypass only if
    `ai_engine.privacy_mode != strict` ; placeholder reverse-mapping
    server-side after response.
- **Tenant API keys in logs**.
  - Mitigation: structured logger redacts `*_api_key` fields ;
    `tenants.ai_config_encrypted` decrypted only at call time, never
    persisted decrypted.
- **Cache poisoning across tenants**.
  - Mitigation: cache keys include `tenant_id` ; cross-tenant cache
    hit impossible.

### Denial of service / Cost exhaustion (LLM10)
- **Tenant exhausts monthly budget** (intentionally or by bug).
  - Mitigation: per-tenant monthly cap in micro-USD ; calls past cap
    rejected with `BUDGET_EXCEEDED` error ; UI shows current spend.
- **Massive token request to bankrupt the tenant**.
  - Mitigation: per-call input token cap (100K) and output cap (16K) ;
    streaming required for >60s calls.
- **Provider rate limit cascade**.
  - Mitigation: per-tenant request rate limit (60 calls/min default) ;
    CircuitBreaker per provider ; fallback provider per task.

### Elevation of privilege
- **AI worker bypasses LLM Router and calls provider directly**.
  - Mitigation: workers have **no** outbound network access except to
    `apps/api` and NATS (Helm NetworkPolicy in prod ; documented in
    Docker Compose for dev).

## 4. OWASP LLM Top 10 mapping

| ID | Status | Notes |
|---|---|---|
| LLM01 Prompt injection | mitigated | `<untrusted_content>` tagging + system prompt instructions + adversarial fixtures in eval |
| LLM02 Sensitive info disclosure | mitigated | PII scrubber + privacy_mode strict |
| LLM03 Supply chain | mitigated | Provider TLS pinning + Ollama models pulled by digest |
| LLM04 Data/Model poisoning | mitigated | Ontology RAG read-only at runtime + signed chunks |
| LLM05 Improper output handling | mitigated | Pydantic validation + native engine validation for compiled artifacts |
| LLM06 Excessive agency | mitigated | Tool whitelist (cf. ADR 011) + no shell/eval/HTTP tools |
| LLM07 System prompt leakage | mitigated | Prompts as secrets + output scrubber |
| LLM08 Vector weaknesses | mitigated | Tenant-partitioned embeddings (cf. ADR 007) |
| LLM09 Misinformation | mitigated | Hallucination guard (Q01) + LLM-as-judge with confidence + UI badges |
| LLM10 Unbounded consumption | mitigated | Rate limit + budget cap + token caps + streaming required |

## 5. Mitigations summary

| # | Mitigation | Where | Verified by |
|---|---|---|---|
| 1 | TLS pinning per provider | `providers/*/roots.ts` | manual + integration |
| 2 | PII scrubber | `scrubber.ts` | unit + golden eval |
| 3 | Budget cap | `router.ts` | unit |
| 4 | Rate limit | `router.ts` (Redis sliding window) | integration |
| 5 | Token caps | `router.ts` | unit |
| 6 | Audit log per call | `audit.ts` | unit |
| 7 | System prompt scrubber on output | `output-scrubber.ts` | unit + adversarial |
| 8 | Cache key tenant prefix | `cache.ts` | unit |
| 9 | Untrusted content wrapping | every prompt template | unit + eval |
| 10 | Tool whitelist enforcement | PydanticAI + framework wrapper | unit |

## 6. Accepted residual risks

- **Provider data retention** (some providers keep prompts in their
  training/abuse pipeline). Mitigated by tenant choice : route to
  privacy-respecting provider (Mistral La Plateforme zero-retention
  option) or local Ollama.
- **Provider compromise** (Anthropic / Mistral itself breached). Out of
  scope ; mitigated by tenant choice and segregation.
- **Adversarial output that passes Pydantic validation but is still
  malicious** (e.g., compliant TAI Intent that compiles to a harmful
  Rego). Mitigated by `opa parse` validation + test fixtures + human
  review on high-impact intents.

## 7. Open questions

- Implement cryptographic prompt signing (each prompt hash stored, model
  attests it received the right one)? Probably overkill ; defer.
- Per-call cost prediction (warn before sending if cost will exceed
  threshold)? Yes, M5+ as a UX win.
