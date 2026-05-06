"""
Pytest-based classification scorer (cf. ADR 009).

Tests the heuristic classifier (template_only mode — no LLM required)
against the 20 golden fixtures in clf_fixtures.yaml.

Run:
  uv run pytest tests/eval/runners/test_classification.py -v

Expected: ≥ 75% pass rate on heuristic (LLM mode targets ≥ 95%).
"""

from __future__ import annotations

import pathlib
import sys

import pytest
import yaml

# Make agents_compliance importable from test runner
REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "agents" / "compliance" / "src"))

from agents_compliance.agent import _heuristic_classify  # noqa: E402


FIXTURES_PATH = (
    pathlib.Path(__file__).parent.parent
    / "fixtures"
    / "classification"
    / "clf_fixtures.yaml"
)


def load_fixtures() -> list[dict]:
    with FIXTURES_PATH.open() as f:
        data = yaml.safe_load(f)
    return data["fixtures"]


FIXTURES = load_fixtures()


@pytest.mark.parametrize(
    "fixture",
    FIXTURES,
    ids=[f["id"] for f in FIXTURES],
)
def test_heuristic_classify(fixture: dict) -> None:
    """Heuristic classifier matches expected layer.

    Fixtures marked `xfail_heuristic: true` represent known limitations of the
    keyword-based heuristic (template_only mode). They are expected to fail
    and do not count against the ≥75% target (ADR 009).
    """
    if fixture.get("xfail_heuristic"):
        pytest.xfail(
            f"Known heuristic limitation: {fixture.get('hint', fixture['id'])}"
        )

    result = _heuristic_classify(fixture["id"], fixture["text"])
    assert result.chunk_id == fixture["id"]
    assert result.inferred_layer.value == fixture["expected_layer"], (
        f"[{fixture['id']}] Expected {fixture['expected_layer']!r}, "
        f"got {result.inferred_layer.value!r}. "
        f"Hint: {fixture.get('hint', '')}"
    )


def test_all_fixtures_have_unique_ids() -> None:
    ids = [f["id"] for f in FIXTURES]
    assert len(ids) == len(set(ids)), "Duplicate fixture IDs detected"


def test_fixture_count() -> None:
    assert len(FIXTURES) >= 20, f"Expected ≥20 fixtures, got {len(FIXTURES)}"


def test_layer_distribution() -> None:
    """Ensure fixture set covers all 5 layers."""
    layers = {f["expected_layer"] for f in FIXTURES}
    required = {"directive", "policy", "procedure", "process", "kpi"}
    assert required == layers, f"Missing layers: {required - layers}"
