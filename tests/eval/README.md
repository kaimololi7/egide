# tests/eval — Egide LLM evaluation framework (cf. ADR 009)
#
# Structure:
#   fixtures/classification/  — 20 text snippets with expected pyramid layer
#   fixtures/generation/      — policy generation inputs with expected properties
#   runners/                  — pytest-based scoring runners
#
# Run:
#   uv run pytest tests/eval/ -v
#
# Scoring:
#   Classification: exact match on inferred_layer (pass/fail)
#   Generation: structural checks (has requirements ≥1, cites ≥1 anchor)
#   Coherence: (M3+) — reserved for validate tool integration
