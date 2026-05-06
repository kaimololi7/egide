# egide-agents-common

Shared library for Egide AI workers (cf. ADR 011 — agent strategy).

## Status

Scaffold. CircuitBreaker is functional, others are stubs. Full
implementations land at M1 sprint S2.

## Provides

- **CircuitBreaker** — async state machine for provider failure
  isolation (CLOSED → OPEN → HALF_OPEN). Port from aegis-platform.
- **LLMRouterClient** — async HTTP adapter to `apps/api` LLM Router.
  AI workers never call providers directly — every call goes through
  here, audited.
- **AuditContext** + **AuditedToolWrapper** — typed audit metadata
  threaded through every tool invocation.
- **HallucinationGuard** — coherence rule Q01: rejects LLM output
  citing unknown ontology anchors.
- **Typed errors** — mirror `packages/llm-router/src/errors.ts`.

## Dependencies

- **PydanticAI** — agent framework (cf. ADR 011 Strategy B).
- **Instructor** — structured-output fallback for providers without
  native tool use (Ollama 7B).
- **httpx** — async HTTP client for LLMRouterClient.
- **nats-py** — NATS JetStream subscriber (consume jobs, publish
  events).
- **structlog** — structured logging with PII redaction.
- **tenacity** — retry with exponential backoff.

## Usage (after S2)

```python
from agents_common import (
    AuditContext,
    CircuitBreaker,
    HallucinationGuard,
    LLMRouterClient,
)

async with LLMRouterClient(
    base_url="http://localhost:3001",
    api_token=tenant_token,
) as router:
    response = await router.complete(
        task_type="generation",
        request=CompleteRequest(
            system_prompt=load_prompt("compliance/draft_policy"),
            messages=[{"role": "user", "content": "..."}],
        ),
        audit=AuditContext(
            tenant_id=tenant_id,
            pyramid_id=pyramid.id,
            journey_phase="j1.draft_policy",
            worker_name="agents.compliance",
        ),
    )

    await guard.verify(response.content)  # Q01
```

## Reference

- ADR 011 — Agent strategy (super-agent + PydanticAI)
- ADR 004 — LLM Router
- ADR 014 — Security (LLM Top 10)
- `docs/threat-models/llm-router.md`
