# ADR 011 — Agent strategy: super-agent multi-step + PydanticAI

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder

## Context

The skills (`.claude/skills/iso27001-2022.md`, `pyramid-coherence-rules.md`,
etc.) reference ~10 specialized agents (`ontology-modeler`,
`policy-generator`, `procedure-generator`, `bpmn-generator`,
`kpi-designer`, `process-architect`, `compliance-mapper`,
`audit-readiness-checker`, `coherence-validator`, `cultural-localizer`).

The architecture only declares 3 directories (`agents/common`,
`agents/compliance`, `agents/orchestrator`). This is a structural
mismatch.

Three strategies are available:

| Strategy | Description | Cost | Risk |
|---|---|---|---|
| **A — minimal AI + templates** | 1 generalist agent ; rest = deterministic templates | Lowest dev cost | Loses AI-first differentiation |
| **B — super-agent multi-step** | 1 multi-step agent with ~10 internal **tools** (`draft_policy`, `draft_procedure`, …) | Medium | Hard to debug when LLM derails ; needs strong scoring |
| **C — pipeline of specialized agents** | N specialized agents orchestrated by a workflow | Highest, requires queue + eval + observability | Most robust at scale |

## Decision

### Strategy B at MVP, evolve to C when traction justifies

We adopt **Strategy B**: one multi-step agent (`agents/compliance`) with
internal tools that are individually testable Python functions, plus a
thin `agents/orchestrator` that handles long-running workflows (drop docs
→ pyramid generation, takes 5–15 min).

This avoids:

- The premature explosion of 10 agent processes each with their own
  prompts, tests, observability surface.
- The orchestration overhead of a true agent pipeline before we know
  which decomposition works in practice.

It preserves:

- The ability to extract a sub-agent later when one specific tool grows
  too complex (e.g., `bpmn-generator` may become its own agent in M5+).
- A clean test surface: each tool = one Python function = one unit test.

Migration to Strategy C (pipeline of N specialized agents) happens when:

- A specific tool exceeds 500 LOC of orchestration logic, OR
- We need parallel execution of the same step across many tenants
  (cabinet/MSSP J7), OR
- Per-tool model routing becomes too constrained inside one agent.

### Framework: PydanticAI + Instructor

The Python AI workers use **PydanticAI** as the agent framework.

| Option | Verdict |
|---|---|
| **PydanticAI** | ✅ Type-safe, Pydantic-native structured outputs, multi-provider (Anthropic/Mistral/Ollama/OpenAI-compat), tools as decorated Python functions, by Pydantic team (mature stewardship) |
| Custom port of aegis BaseAgent | ⚠️ Reinvents what PydanticAI does ; keep BaseAgent only for CircuitBreaker + LLM Router client + audit trail |
| LangChain | ❌ Code-smell, breaking changes, sur-abstraction |
| LlamaIndex | ❌ RAG-first, not agent-first |
| CrewAI / AutoGen | ❌ Toy-grade for prod, observability weak |
| Anthropic Agent SDK | ❌ Locks to Claude, breaks multi-provider promise of ADR 004 |
| DSPy | ❌ Programmatic prompt optimization is overkill solo |

**Instructor** complements PydanticAI when a provider does not natively
support structured outputs (Ollama 7B falls back to JSON-only via grammar
constraints).

### What stays from aegis BaseAgent

We **keep**:

- `CircuitBreaker` (provider failure isolation)
- `LLMClient` adapter (calls `apps/api` LLM Router via NATS or HTTP)
- Audit trail wrapper (writes to `llm_calls` table, cf. ADR 004)
- Structured logging with trace_id propagation

We **drop** (replaced by PydanticAI):

- Direct Anthropic SDK invocation
- Custom tool calling protocol harmonization
- Manual JSON parsing of LLM outputs

### Tool registry pattern

In Strategy B, the super-agent has a **whitelist of internal tools**:

```python
from pydantic_ai import Agent, RunContext

compliance_agent = Agent(
    model="...",  # injected via LLM Router config
    deps_type=AgentDeps,
    system_prompt=COMPLIANCE_SYSTEM_PROMPT,
)

@compliance_agent.tool
async def search_anchors(
    ctx: RunContext[AgentDeps],
    query: str,
    framework: str | None = None,
) -> list[AnchorMatch]:
    """Find normative anchors matching a query (RAG via pgvector)."""
    return await ctx.deps.rag.search(query, framework=framework)

@compliance_agent.tool
async def draft_policy(
    ctx: RunContext[AgentDeps],
    cluster_id: str,
    anchors: list[str],
) -> PolicyDraft:
    """Draft a Policy N1 from a cluster + cited anchors."""
    return await ctx.deps.generators.policy(cluster_id, anchors)

# ... draft_procedure, draft_bpmn, draft_kpi, validate, gap_analysis, ...
```

Tools are tested as plain Python functions. Agent runs are eval'd via
the framework in ADR 009.

### Hallucination guard (mandatory)

Every tool that emits anchor strings is post-processed by a validator
that checks `ontology_chunks.anchor_ref`. Miss → retry with correction
prompt; second miss → reject.

### Per-task LLM routing

Each tool declares its preferred routing profile via metadata:

| Tool | Profile | Default provider |
|---|---|---|
| `search_anchors` | embedding | mistral-embed / nomic-embed |
| `classify_chunk` | classification | haiku-4-5 / mistral-small / ollama-mistral-7b |
| `draft_policy` | generation | sonnet-4-6 / mistral-large |
| `judge_coherence` | judge | sonnet-4-6 / mistral-large |
| `synthesize_summary` | synthesis | opus-4-7 / mistral-large |

Routing is enforced by the LLM Router (ADR 004) via the `task_type` field.

## Security controls (cf. ADR 014, LLM06 + LLM01)

The agent strategy enforces several OWASP LLM Top 10 (2025) controls at
the framework level:

- **LLM06 Excessive agency** — every tool declares mandatory metadata
  enforced by the framework wrapper:
  - `read_only: true|false` — read-only tools never trigger persistence
  - `requires_approval: true|false` — when true, tool execution emits
    an `approval_request` (ADR 010) and waits on
    `egide.governance.actions` instead of executing directly
  - `tenant_scoped: true|false` — tools that touch tenant data verify
    `ctx.tenant_id` matches the input
  - `cost_class: cheap|expensive` — expensive tools count against the
    per-tenant rate limit and budget cap (ADR 004)
- **No `shell` / `eval` / arbitrary HTTP tool**. Adding a new tool that
  could mutate production state requires an ADR amendment.
- **LLM01 Prompt injection** — agent prompts wrap untrusted content
  (document text, tool results from collectors) in
  `<untrusted_content>...</untrusted_content>` tags ; system prompts
  instruct the model not to follow instructions inside ; adversarial
  fixtures in the eval suite.
- **Tool timeout** default 60s ; exceeded → cancel + log + circuit
  breaker open (CircuitBreaker still kept from aegis).
- **Output validation** — every tool output is Pydantic-validated ;
  schema mismatch = reject + log + retry with correction prompt.

## Consequences

- `agents/common/` ships PydanticAI + Instructor + custom CircuitBreaker
  + LLM Router adapter.
- `agents/compliance/` is one multi-step PydanticAI Agent with ~10 tools.
- `agents/orchestrator/` is the long-running workflow runner that drives
  J1 / pyramid generation, listening on NATS subjects.
- The 10 implicit agents in skills are **renamed as tools** in the
  super-agent. Skills are updated accordingly.
- `pyproject.toml` adds `pydantic-ai`, `instructor`, drops any LangChain.
- Eval suite (ADR 009) tests tools in isolation **and** end-to-end agent runs.

## Open questions

- When does a tool justify being extracted as a sub-agent? Heuristic:
  > 500 LOC of orchestration, OR > 5 sub-tools, OR independent SLA.
- Should `agents/orchestrator` be a PydanticAI agent itself or a plain
  Python state machine? Plain state machine — orchestration is
  deterministic, not LLM-driven.
