"""
Pydantic models shared by all compliance agent tools.

These types flow through the PydanticAI super-agent (cf. ADR 011 Strategy B):
  - tool inputs are validated on entry
  - tool outputs are structured and auditable
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


# ── Framework anchors (normative references) ──────────────────────────────────

class NormativeAnchor(BaseModel):
    """A cited reference in a normative framework (ISO, NIS2, DORA, etc.)."""

    chunk_id: str
    framework: str  # e.g., "ISO27001:2022", "NIS2", "DORA"
    clause: str  # e.g., "A.8.7", "Art.21", "Art.9"
    title: str
    text: str
    similarity_score: float = Field(ge=0.0, le=1.0)


# ── Pyramid layer types ────────────────────────────────────────────────────────

class PyramidLayer(str, Enum):
    DIRECTIVE = "directive"
    POLICY = "policy"
    PROCEDURE = "procedure"
    PROCESS = "process"
    KPI = "kpi"


class ClassifiedChunk(BaseModel):
    """An extracted document chunk classified against the governance pyramid."""

    chunk_id: str
    text: str
    inferred_layer: PyramidLayer
    inferred_framework: str | None = None
    inferred_clause: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str


# ── Draft artifacts ────────────────────────────────────────────────────────────

class DraftPolicy(BaseModel):
    """A governance policy artifact generated from document chunks + anchors."""

    title: str
    scope: str
    purpose: str
    requirements: list[str] = Field(min_length=1)
    normative_references: list[str]  # e.g., ["ISO27001:2022 A.8.7", "NIS2 Art.21"]
    owner: str | None = None
    review_cycle_months: int = 12
    layer: Literal[PyramidLayer.POLICY] = PyramidLayer.POLICY


class GapFinding(BaseModel):
    """A compliance gap detected between current state and normative anchor."""

    gap_id: str
    anchor: NormativeAnchor
    description: str
    severity: Literal["critical", "major", "minor", "observation"]
    affected_layer: PyramidLayer
    remediation_hint: str | None = None


class GapAnalysis(BaseModel):
    """Aggregate output of the gap analysis tool."""

    pyramid_id: str
    framework: str
    findings: list[GapFinding]
    coverage_pct: float = Field(ge=0.0, le=100.0)
    summary: str


# ── Validation result ──────────────────────────────────────────────────────────

class ValidationIssue(BaseModel):
    rule_id: str
    description: str
    severity: Literal["error", "warning", "info"]
    affected_node_id: str | None = None


class ValidationResult(BaseModel):
    """Output of the validate tool (deterministic rules + semantic checks)."""

    pyramid_id: str
    passed: bool
    issues: list[ValidationIssue]
    rules_evaluated: int
    rules_passed: int
