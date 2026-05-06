# ADR 009 — Eval framework: custom pytest at MVP, Inspect AI later

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder

## Context

AI workers (`agents/compliance`, `agents/orchestrator`) make decisions that
are non-deterministic and change with prompt edits, model upgrades, and
provider switches. Without a regression suite, we cannot:

- Tell whether Mistral Large performs as well as Sonnet 4.6 on **our**
  classification task (one of the founding promises of ADR 004).
- Detect prompt regressions when refactoring.
- Quantify hallucination rate per provider/model.
- Decide which provider to default routing to.

A LLM observability tool (Langfuse, Phoenix) tracks **production** runs.
An eval framework tests **before** production. They are complementary.

## Decision

### MVP: custom pytest + golden datasets

A simple folder layout under `tests/eval/`:

```
tests/eval/
├── conftest.py                    # shared fixtures, LLM router stubs
├── golden/
│   ├── classification/
│   │   ├── doc_iso27001_extract_001.json   # input chunk
│   │   └── doc_iso27001_extract_001.expected.json   # expected anchors
│   ├── generation/
│   │   ├── cluster_change_mgmt.input.json
│   │   └── cluster_change_mgmt.expected.json
│   └── coherence/
│       ├── pyramid_with_sla_conflict.json
│       └── pyramid_with_sla_conflict.expected_errors.json
├── test_classification.py
├── test_generation.py
├── test_coherence_judge.py
└── runners/
    └── score.py                   # weighted accuracy / F1 / hallucination rate
```

Each test runs the agent against a fixture and asserts:

- **Classification**: precision/recall on returned anchor set.
- **Generation**: structural conformance (TAI Intent valid? required
  fields present? hallucinated anchors? coherence rules pass?).
- **Coherence judge** (LLM-as-judge): agreement with human-curated truth.

### Targets

For MVP, golden dataset starts small:

- **20 classification fixtures** covering ISO 27001 + NIS2.
- **10 generation fixtures** (one per cluster).
- **15 coherence fixtures** (positive + negative for the 5 hardest rules).

Grow to 50 / 30 / 30 by M3.

### Per-provider matrix

The same suite runs against each registered provider:

```bash
EGIDE_EVAL_PROVIDER=anthropic_sonnet pytest tests/eval/
EGIDE_EVAL_PROVIDER=mistral_large pytest tests/eval/
EGIDE_EVAL_PROVIDER=ollama_mistral_7b pytest tests/eval/
```

CI runs all three nightly and posts a comparison report to a Postgres
`eval_runs` table. The README contains a published score matrix.

### Hallucination guard as a runtime safety net

Every AI worker output containing `anchor_ref` is checked against
`ontology_chunks.anchor_ref` (cf. ADR 007). A miss = retry once with a
correction prompt; second miss = reject and surface to user.

This is **production code**, not test code. Eval framework measures the
**rate** of hallucinations per provider; the guard catches them at runtime.

### Pro+ (deferred): Inspect AI

When customers ask for formal eval reports (audit-grade), migrate to
**Inspect AI** (UK AISI, Apache 2.0). It is the most rigorous LLM eval
framework available end-2025: scorers, datasets, runners, structured logs.
Not MVP because the simple pytest stack covers our needs and avoids a
new dependency.

### What we explicitly do NOT use

| Tool | Why not |
|---|---|
| LangSmith | SaaS, sovereign-incompatible |
| Promptfoo | YAML-driven, less flex than pytest |
| DeepEval | LLM-as-judge integrated but young |
| Ragas | RAG-specific, useful only when we eval the RAG layer separately |

## Consequences

- `tests/eval/` becomes part of CI from M1.
- Each agent prompt change requires a passing eval run on the relevant
  golden subset.
- A nightly GHA workflow runs the full matrix and writes results.
- `docs/eval-results.md` (auto-generated) shows current scores per
  provider/model. Public — credibility lever for the persona ("here is
  what Egide actually does on our test set, and here is how Ollama compares
  to Anthropic").
- Adding a new provider requires running eval before it can be a
  recommended default in the LLM Router.

## Open questions

- Do we open-source the golden dataset itself (helpful for community
  contributions) or keep it private (avoid overfit by clients)? Probably
  open-source the structure, keep some held-out negatives private.
- Should we include adversarial fixtures (jailbreak attempts, prompt
  injection)? Likely yes from M3+ — Inspect AI has built-in support.
