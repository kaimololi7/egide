"""
Pytest-based gap analysis model scorer (cf. ADR 009).

Tests the Pydantic model constructors and GapFinding validation
without LLM calls (pure unit tests).

Run:
  uv run pytest tests/eval/runners/test_models.py -v
"""

from __future__ import annotations

import pathlib
import sys
import uuid

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "agents" / "compliance" / "src"))

from agents_compliance.models import (  # noqa: E402
    GapFinding,
    GapAnalysis,
    NormativeAnchor,
    PyramidLayer,
    ValidationIssue,
    ValidationResult,
)


# ── NormativeAnchor ───────────────────────────────────────────────────────────

def _anchor(**kwargs) -> NormativeAnchor:
    defaults = dict(
        chunk_id=str(uuid.uuid4()),
        framework="ISO27001:2022",
        clause="A.8.7",
        title="Malware protection",
        text="Controls against malware SHALL be implemented.",
        similarity_score=0.92,
    )
    return NormativeAnchor(**(defaults | kwargs))


def test_anchor_similarity_bounds():
    a = _anchor(similarity_score=1.0)
    assert a.similarity_score == 1.0
    import pydantic
    with pytest.raises((pydantic.ValidationError, ValueError)):
        _anchor(similarity_score=1.1)


import pytest


def test_anchor_similarity_zero():
    a = _anchor(similarity_score=0.0)
    assert a.similarity_score == 0.0


# ── GapFinding ────────────────────────────────────────────────────────────────

def test_gap_finding_severity_values():
    anchor = _anchor()
    for severity in ("critical", "major", "minor", "observation"):
        gf = GapFinding(
            gap_id=str(uuid.uuid4()),
            anchor=anchor,
            description=f"Gap at severity {severity}",
            severity=severity,
            affected_layer=PyramidLayer.POLICY,
        )
        assert gf.severity == severity


def test_gap_finding_invalid_severity():
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        GapFinding(
            gap_id=str(uuid.uuid4()),
            anchor=_anchor(),
            description="bad",
            severity="blocker",  # type: ignore[arg-type]
            affected_layer=PyramidLayer.POLICY,
        )


# ── GapAnalysis ───────────────────────────────────────────────────────────────

def test_gap_analysis_coverage_bounds():
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        GapAnalysis(
            pyramid_id="p1",
            framework="ISO27001:2022",
            findings=[],
            coverage_pct=101.0,
            summary="out of range",
        )


def test_gap_analysis_empty_findings():
    ga = GapAnalysis(
        pyramid_id=str(uuid.uuid4()),
        framework="NIS2",
        findings=[],
        coverage_pct=0.0,
        summary="No coverage yet.",
    )
    assert len(ga.findings) == 0


# ── ValidationResult ──────────────────────────────────────────────────────────

def test_validation_result_passed():
    vr = ValidationResult(
        pyramid_id=str(uuid.uuid4()),
        passed=True,
        issues=[],
        rules_evaluated=25,
        rules_passed=25,
    )
    assert vr.passed is True
    assert vr.rules_passed == vr.rules_evaluated


def test_validation_result_with_issues():
    issue = ValidationIssue(
        rule_id="R-001",
        description="Policy must cite at least one anchor",
        severity="error",
        affected_node_id=str(uuid.uuid4()),
    )
    vr = ValidationResult(
        pyramid_id=str(uuid.uuid4()),
        passed=False,
        issues=[issue],
        rules_evaluated=25,
        rules_passed=24,
    )
    assert not vr.passed
    assert len(vr.issues) == 1
    assert vr.issues[0].rule_id == "R-001"


# ── PyramidLayer enum ─────────────────────────────────────────────────────────

def test_pyramid_layer_values():
    assert PyramidLayer.DIRECTIVE.value == "directive"
    assert PyramidLayer.POLICY.value == "policy"
    assert PyramidLayer.PROCEDURE.value == "procedure"
    assert PyramidLayer.PROCESS.value == "process"
    assert PyramidLayer.KPI.value == "kpi"
