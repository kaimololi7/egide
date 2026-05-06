"""
Tool: classify_chunk

Classifies an extracted document chunk against the governance pyramid layers
(Directive / Policy / Procedure / Process / KPI) and infers its normative
framework clause if possible.

Runs via the LLMRouterClient (never calls provider directly).
Cf. ADR 011 (super-agent tools) + ADR 014 §LLM09 (hallucination guard).
"""

from __future__ import annotations

import logging
import uuid

from pydantic import BaseModel
from pydantic_ai import Agent  # type: ignore[import-untyped]

from ..models import ClassifiedChunk, PyramidLayer

logger = logging.getLogger(__name__)


class _ClassifyInput(BaseModel):
    chunk_id: str
    text: str
    context_hint: str | None = None


class _ClassifyOutput(BaseModel):
    inferred_layer: PyramidLayer
    inferred_framework: str | None
    inferred_clause: str | None
    confidence: float
    rationale: str


_SYSTEM_PROMPT = """\
You are a governance classification expert. Given an excerpt from a corporate
document, classify it against the governance pyramid layer it belongs to:

- directive: high-level mandate, board-level intent, mission statement
- policy: what MUST or MUST NOT be done (rules, obligations)
- procedure: step-by-step instructions on HOW to implement a policy
- process: operational workflow, swimlane, BPMN-style description
- kpi: measurable indicator, metric, target, SLA/SLO

Also infer the most likely normative framework clause if the text references
or implies one (e.g., "ISO27001:2022 A.8.7", "NIS2 Art.21(2)(b)").

Return ONLY JSON matching the schema — no prose outside the JSON object.
"""


async def classify_chunk(
    chunk_id: str,
    text: str,
    *,
    context_hint: str | None = None,
    model_name: str = "openai:gpt-4o",  # overridden by LLM router in production
    tenant_id: str,
    trace_id: str | None = None,
) -> ClassifiedChunk:
    """
    Classify a text chunk against the pyramid layers.

    The model_name is injected by the super-agent based on the tenant's
    LLM router configuration; it defaults to a placeholder for tests.

    Raises:
        pydantic_ai.exceptions.UnexpectedModelBehavior: on parse failure.
    """
    agent: Agent[None, _ClassifyOutput] = Agent(
        model_name,
        system_prompt=_SYSTEM_PROMPT,
        result_type=_ClassifyOutput,
    )

    prompt = f"Chunk ID: {chunk_id}\n\nText:\n{text}"
    if context_hint:
        prompt += f"\n\nContext hint: {context_hint}"

    result = await agent.run(prompt)
    output = result.data

    logger.info(
        "classify_chunk: layer=%s confidence=%.2f",
        output.inferred_layer,
        output.confidence,
        extra={
            "tenant_id": tenant_id,
            "trace_id": trace_id,
            "chunk_id": chunk_id,
        },
    )

    return ClassifiedChunk(
        chunk_id=chunk_id or str(uuid.uuid4()),
        text=text,
        inferred_layer=output.inferred_layer,
        inferred_framework=output.inferred_framework,
        inferred_clause=output.inferred_clause,
        confidence=output.confidence,
        rationale=output.rationale,
    )
