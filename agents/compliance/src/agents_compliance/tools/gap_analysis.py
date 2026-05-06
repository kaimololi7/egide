"""
Tool: gap_analysis

Identifies compliance gaps between the current pyramid state and a target
normative framework. Uses the normative RAG index for anchor coverage.

Cf. ADR 011 (J4 continuous-compliance dashboard).
"""

from __future__ import annotations

import logging
import uuid

from pydantic import BaseModel
from pydantic_ai import Agent  # type: ignore[import-untyped]

from ..models import GapAnalysis, GapFinding, NormativeAnchor, PyramidLayer

logger = logging.getLogger(__name__)


class _GapFindingOutput(BaseModel):
    anchor_chunk_id: str
    description: str
    severity: str  # "critical" | "major" | "minor" | "observation"
    affected_layer: str  # PyramidLayer value
    remediation_hint: str | None


class _GapAnalysisOutput(BaseModel):
    findings: list[_GapFindingOutput]
    coverage_pct: float
    summary: str


_SYSTEM_PROMPT = """\
You are a compliance gap analyst. Given the current state of a governance
pyramid (list of existing policy titles/summaries) and a set of mandatory
normative anchors that MUST be covered, identify gaps.

For each anchor NOT covered by the current pyramid:
- Describe the gap precisely.
- Rate severity: critical (legal/regulatory breach risk), major (significant
  non-conformity), minor (partial coverage), observation (best practice gap).
- Suggest a remediation hint (one sentence).
- Identify which pyramid layer (directive/policy/procedure/process/kpi) is missing.

Return ONLY JSON matching the schema.
"""


def _severity_literal(s: str) -> GapFinding.__annotations__["severity"]:  # type: ignore[misc]
    allowed = {"critical", "major", "minor", "observation"}
    return s if s in allowed else "observation"  # type: ignore[return-value]


async def gap_analysis(
    pyramid_id: str,
    framework: str,
    existing_policy_summaries: list[str],
    required_anchors: list[NormativeAnchor],
    *,
    model_name: str = "openai:gpt-4o",
    tenant_id: str,
    trace_id: str | None = None,
) -> GapAnalysis:
    """
    Perform gap analysis for a pyramid against a set of required anchors.

    Args:
        pyramid_id:                 UUID of the pyramid being analyzed.
        framework:                  Target framework name.
        existing_policy_summaries:  Short summaries of what exists.
        required_anchors:           Anchors that MUST be covered.
        model_name:                 LLM model string.
        tenant_id:                  Tenant UUID.
        trace_id:                   Distributed trace ID.
    """
    agent: Agent[None, _GapAnalysisOutput] = Agent(
        model_name,
        system_prompt=_SYSTEM_PROMPT,
        result_type=_GapAnalysisOutput,
    )

    anchor_block = "\n".join(
        f"  [{a.chunk_id}] {a.framework} {a.clause} — {a.title}"
        for a in required_anchors
    )
    existing_block = "\n".join(f"  - {s}" for s in existing_policy_summaries[:30])

    prompt = (
        f"Framework: {framework}\n"
        f"Pyramid ID: {pyramid_id}\n\n"
        f"Required anchors (must all be covered):\n{anchor_block}\n\n"
        f"Existing policies/procedures in pyramid:\n{existing_block}"
    )

    result = await agent.run(prompt)
    output = result.data

    findings: list[GapFinding] = []
    for f in output.findings:
        try:
            affected_layer = PyramidLayer(f.affected_layer)
        except ValueError:
            affected_layer = PyramidLayer.POLICY

        # Find matching anchor
        anchor = next(
            (a for a in required_anchors if a.chunk_id == f.anchor_chunk_id),
            NormativeAnchor(
                chunk_id=f.anchor_chunk_id,
                framework=framework,
                clause="unknown",
                title="unknown",
                text="",
                similarity_score=0.0,
            ),
        )

        findings.append(
            GapFinding(
                gap_id=str(uuid.uuid4()),
                anchor=anchor,
                description=f.description,
                severity=_severity_literal(f.severity),
                affected_layer=affected_layer,
                remediation_hint=f.remediation_hint,
            )
        )

    logger.info(
        "gap_analysis: %d findings, coverage=%.1f%%",
        len(findings),
        output.coverage_pct,
        extra={"tenant_id": tenant_id, "trace_id": trace_id, "pyramid_id": pyramid_id},
    )

    return GapAnalysis(
        pyramid_id=pyramid_id,
        framework=framework,
        findings=findings,
        coverage_pct=min(max(output.coverage_pct, 0.0), 100.0),
        summary=output.summary,
    )
