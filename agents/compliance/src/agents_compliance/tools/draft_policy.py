"""
Tool: draft_policy

Generates a governance policy artifact from classified chunks and normative
anchors. MUST be called AFTER search_anchors — every policy MUST cite at
least one anchor (cf. ADR 014 §LLM09 hallucination guard, principle #1).

The generated policy goes to the validator before persistence.
"""

from __future__ import annotations

import logging

from pydantic import BaseModel
from pydantic_ai import Agent  # type: ignore[import-untyped]

from ..models import DraftPolicy, NormativeAnchor, PyramidLayer

logger = logging.getLogger(__name__)


class _DraftPolicyInput(BaseModel):
    subject: str
    chunks: list[str]  # raw text excerpts providing context
    anchors: list[str]  # formatted anchor strings, e.g. "ISO27001:2022 A.8.7 — Malware protection"
    target_layer: PyramidLayer
    framework: str


class _DraftPolicyOutput(BaseModel):
    title: str
    scope: str
    purpose: str
    requirements: list[str]
    normative_references: list[str]
    owner: str | None
    review_cycle_months: int


_SYSTEM_PROMPT = """\
You are a governance policy author for an EU-based organisation.
Given document excerpts and normative framework anchors, draft a concise
governance policy in English at the requested pyramid layer.

Rules:
1. Every requirement MUST be traceable to at least one provided normative anchor.
2. Use "MUST", "SHOULD", "MAY" (RFC 2119) for obligations.
3. Keep the policy atomic — one control domain per policy.
4. Do NOT invent framework references not present in the provided anchors.
5. requirements list: each item is one sentence, ≤ 150 characters.

Return ONLY JSON matching the schema.
"""


def _format_anchor(a: NormativeAnchor) -> str:
    return f"{a.framework} {a.clause} — {a.title}"


async def draft_policy(
    subject: str,
    chunks: list[str],
    anchors: list[NormativeAnchor],
    *,
    target_layer: PyramidLayer = PyramidLayer.POLICY,
    framework: str,
    model_name: str = "openai:gpt-4o",
    tenant_id: str,
    trace_id: str | None = None,
) -> DraftPolicy:
    """
    Generate a draft governance policy.

    Args:
        subject:      Topic of the policy (e.g., "malware protection").
        chunks:       Relevant document excerpts.
        anchors:      Normative anchors from search_anchors (≥1 required).
        target_layer: Pyramid layer (usually POLICY).
        framework:    Primary target framework.
        model_name:   LLM model string (injected by router).
        tenant_id:    Tenant UUID.
        trace_id:     Distributed trace ID.

    Raises:
        ValueError: if no anchors provided (hallucination guard).
    """
    if not anchors:
        raise ValueError(
            "draft_policy requires at least one normative anchor. "
            "Call search_anchors first. (ADR 014 §LLM09)"
        )

    agent: Agent[None, _DraftPolicyOutput] = Agent(
        model_name,
        system_prompt=_SYSTEM_PROMPT,
        result_type=_DraftPolicyOutput,
    )

    anchor_strs = [_format_anchor(a) for a in anchors]
    prompt = (
        f"Subject: {subject}\n"
        f"Framework: {framework}\n"
        f"Layer: {target_layer.value}\n\n"
        f"Normative anchors (cite these):\n"
        + "\n".join(f"  - {a}" for a in anchor_strs)
        + "\n\nDocument excerpts:\n"
        + "\n---\n".join(chunks[:8])  # cap context window
    )

    result = await agent.run(prompt)
    output = result.data

    logger.info(
        "draft_policy: title=%r reqs=%d",
        output.title,
        len(output.requirements),
        extra={"tenant_id": tenant_id, "trace_id": trace_id, "subject": subject},
    )

    return DraftPolicy(
        title=output.title,
        scope=output.scope,
        purpose=output.purpose,
        requirements=output.requirements,
        normative_references=output.normative_references,
        owner=output.owner,
        review_cycle_months=output.review_cycle_months,
        layer=PyramidLayer.POLICY,
    )
