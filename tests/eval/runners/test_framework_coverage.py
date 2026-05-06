"""Framework coverage runner — NIS2 + CIS v8.1 + DORA.

Validates that the classification + anchor resolution path produces an
acceptable anchor from the target framework for each fixture in
`fixtures/classification/framework_coverage.yaml`.

This runner is **structural** — it does not call an LLM provider. It
asserts that the fixture YAML is well-formed and that every fixture
declares at least one acceptable anchor. The actual anchor resolution
test (with a running RAG + agent) is exercised by the eval matrix
runner (`tests/eval/matrix/run_matrix.py`).

Cf. roadmap.md M6 deliverables (4 frameworks production-ready).
"""

from __future__ import annotations

import pathlib

import pytest
import yaml

FIXTURES = (
    pathlib.Path(__file__).resolve().parent.parent
    / "fixtures"
    / "classification"
    / "framework_coverage.yaml"
)

EXPECTED_FRAMEWORKS = {"nis2", "cis", "dora"}
EXPECTED_KINDS = {"directive", "policy", "procedure", "process", "kpi"}
ANCHOR_PREFIXES = {
    "nis2": "nis2:",
    "cis": "cis-v8.1:",
    "dora": "dora:",
}
MIN_PER_FRAMEWORK = 5


def load() -> list[dict]:
    with FIXTURES.open() as fh:
        return yaml.safe_load(fh)["fixtures"]


def test_yaml_loads() -> None:
    fixtures = load()
    assert fixtures, "framework_coverage.yaml is empty"


@pytest.mark.parametrize("framework", sorted(EXPECTED_FRAMEWORKS))
def test_min_fixtures_per_framework(framework: str) -> None:
    fixtures = [f for f in load() if f.get("framework") == framework]
    assert len(fixtures) >= MIN_PER_FRAMEWORK, (
        f"need at least {MIN_PER_FRAMEWORK} fixtures for {framework}, "
        f"found {len(fixtures)}"
    )


def test_each_fixture_well_formed() -> None:
    for f in load():
        assert "id" in f, f"missing id in {f}"
        assert f.get("framework") in EXPECTED_FRAMEWORKS, f["id"]
        assert f.get("expect_kind") in EXPECTED_KINDS, f["id"]
        anchors = f.get("expect_anchor_in") or []
        assert anchors, f"{f['id']} has no expected anchors"
        prefix = ANCHOR_PREFIXES[f["framework"]]
        assert all(a.startswith(prefix) for a in anchors), (
            f"{f['id']} expected anchors must start with {prefix} (got {anchors})"
        )
        assert isinstance(f.get("text"), str) and f["text"].strip(), f["id"]
