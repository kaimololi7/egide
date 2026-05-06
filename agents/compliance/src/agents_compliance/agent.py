"""
Compliance super-agent (cf. ADR 011 Strategy B).

Single PydanticAI agent with 5 tools that drives the J1 journey:
  1. search_anchors   — ground every artifact in normative clauses (RAG)
  2. classify_chunk   — label each extracted chunk by pyramid layer
  3. draft_policy     — generate a policy artifact from anchors + chunks
  4. gap_analysis     — compare pyramid against required framework coverage
  5. validate         — deterministic validator gate before persistence

The agent is orchestrated by agents/orchestrator via NATS JetStream
(subjects: egide.v1.pyramid.requested → egide.v1.pyramid.generated).

AI mode guard: if EGIDE_AI_MODE == "template_only", all LLM calls are
skipped and stub responses returned (community degraded mode, cf. ADR 004).

Security (cf. ADR 014 §LLM07):
  - Every tool result is validated against Pydantic models before use.
  - No tool has write access to the DB directly — writes go through the API.
  - Tool metadata declares readOnly/requiresApproval per ADR 011.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from .models import (
    ClassifiedChunk,
    DraftPolicy,
    GapAnalysis,
    NormativeAnchor,
    PyramidLayer,
    ValidationResult,
)
from .tools import (
    classify_chunk,
    draft_policy,
    gap_analysis,
    search_anchors,
    validate,
)

logger = logging.getLogger(__name__)

AI_MODE = os.getenv("EGIDE_AI_MODE", "template_only")
VALIDATOR_API_URL = os.getenv("EGIDE_VALIDATOR_URL", "http://localhost:8002")


@dataclass
class SuperAgentConfig:
    tenant_id: str
    validator_api_url: str = VALIDATOR_API_URL
    model_name: str = "openai:gpt-4o"
    trace_id: str | None = None


class ComplianceSuperAgent:
    """
    Stateless super-agent. Each method is one callable unit that the
    orchestrator can invoke independently.

    The agent does NOT hold conversation state between calls — each
    invocation is self-contained and fully auditable.
    """

    def __init__(self, config: SuperAgentConfig) -> None:
        self.config = config
        self._ai_enabled = AI_MODE != "template_only"

    # ── Tool wrappers ────────────────────────────────────────────────────────

    async def search_anchors(
        self,
        query: str,
        frameworks: list[str] | None = None,
        top_k: int = 5,
    ) -> list[NormativeAnchor]:
        """Find normative anchors matching a query."""
        if not self._ai_enabled:
            logger.info("AI disabled — returning empty anchors (template_only mode)")
            return []

        return await search_anchors(
            query=query,
            frameworks=frameworks,
            top_k=top_k,
            validator_api_url=self.config.validator_api_url,
            tenant_id=self.config.tenant_id,
            trace_id=self.config.trace_id,
        )

    async def classify_chunk(
        self,
        chunk_id: str,
        text: str,
        context_hint: str | None = None,
    ) -> ClassifiedChunk:
        """Classify a document chunk against pyramid layers."""
        if not self._ai_enabled:
            # Degraded mode: heuristic layer detection
            return _heuristic_classify(chunk_id, text)

        return await classify_chunk(
            chunk_id=chunk_id,
            text=text,
            context_hint=context_hint,
            model_name=self.config.model_name,
            tenant_id=self.config.tenant_id,
            trace_id=self.config.trace_id,
        )

    async def draft_policy(
        self,
        subject: str,
        chunks: list[str],
        anchors: list[NormativeAnchor],
        framework: str,
        target_layer: PyramidLayer = PyramidLayer.POLICY,
    ) -> DraftPolicy:
        """Generate a policy artifact from chunks and anchors."""
        if not self._ai_enabled:
            return _template_policy(subject, anchors, framework)

        return await draft_policy(
            subject=subject,
            chunks=chunks,
            anchors=anchors,
            target_layer=target_layer,
            framework=framework,
            model_name=self.config.model_name,
            tenant_id=self.config.tenant_id,
            trace_id=self.config.trace_id,
        )

    async def gap_analysis(
        self,
        pyramid_id: str,
        framework: str,
        existing_policy_summaries: list[str],
        required_anchors: list[NormativeAnchor],
    ) -> GapAnalysis:
        """Run gap analysis against required framework coverage."""
        if not self._ai_enabled:
            return GapAnalysis(
                pyramid_id=pyramid_id,
                framework=framework,
                findings=[],
                coverage_pct=0.0,
                summary="AI disabled — manual gap analysis required.",
            )

        return await gap_analysis(
            pyramid_id=pyramid_id,
            framework=framework,
            existing_policy_summaries=existing_policy_summaries,
            required_anchors=required_anchors,
            model_name=self.config.model_name,
            tenant_id=self.config.tenant_id,
            trace_id=self.config.trace_id,
        )

    async def validate(
        self,
        pyramid_id: str,
        artifact: dict[str, Any],
    ) -> ValidationResult:
        """Run deterministic validation (always active, no AI gate)."""
        return await validate(
            pyramid_id=pyramid_id,
            artifact=artifact,
            validator_api_url=self.config.validator_api_url,
            tenant_id=self.config.tenant_id,
            trace_id=self.config.trace_id,
        )


# ── Degraded-mode helpers (template_only) ───────────────────────────────────

def _heuristic_classify(chunk_id: str, text: str) -> ClassifiedChunk:
    """
    Keyword-based layer detection for template_only mode.
    Intentionally conservative — returns POLICY as safe default.

    Uses word-boundary matching for short keywords to avoid false positives
    (e.g. "board" inside "onboarding", "vision" inside "supervision").
    """
    import re

    text_lower = text.lower()

    def has_word(word: str) -> bool:
        """Match whole word only (respects word boundaries)."""
        return bool(re.search(r"\b" + re.escape(word) + r"\b", text_lower))

    # DIRECTIVE — strategic / leadership commitment
    # All checked with word boundaries to avoid false positives:
    # "board" in "onboarding", "mission" in "emission", "vision" in "provisioning"
    directive_exact_words = [
        "board", "mandate", "mission", "vision", "strategic", "strategy",
        "commitment", "commits",
    ]
    directive_phrases = [
        "board of directors", "comex", "chief executive", "ceo ", "coo ",
        "ciso mandate", "management statement", "executive leadership",
        "supervisory board",
    ]
    if (
        any(has_word(w) for w in directive_exact_words)
        or any(w in text_lower for w in directive_phrases)
    ):
        layer = PyramidLayer.DIRECTIVE

    # PROCESS — checked before KPI to avoid false positives from mentions of KPI/metrics
    elif any(
        w in text_lower
        for w in ("lifecycle", "continuous cycle", "pdca", "ongoing process",
                  "recurring", "end-to-end", "risk register", "risk committee",
                  "runs annually", "annual cycle", "quarterly cycle",
                  "processus de gestion", "cycle de", "risk treatment cycle",
                  "improvement backlog", "improvement cycle")
    ) or (
        has_word("cycle") and any(
            w in text_lower for w in ("review", "identify", "assess", "monitor")
        )
    ):
        layer = PyramidLayer.PROCESS

    # KPI — metrics and targets
    elif any(
        w in text_lower
        for w in ("kpi", "metric", "mttd", "mttr", "sla", "slo",
                  "coverage rate", "completion rate", "click rate", "success rate",
                  "pass rate", "error budget", "burn rate",
                  "taux de", "objectif ≤", "objectif ≥", "objectif ",
                  "target ≤", "target ≥",
                  "mesuré", "mesured", "measured weekly", "measured monthly",
                  "reported quarterly", "reported monthly", "reported weekly",
                  "non-conformités", "non-conformities",
                  "below-target", "above-target")
    ):
        layer = PyramidLayer.KPI

    # PROCEDURE — step-by-step instructions with actors and SLAs
    elif any(
        w in text_lower
        for w in ("step", "procedure", "how to", "follow",
                  "submit the", "submits the", "notifies the", "notifie",
                  "creates a ticket", "ouvre un ticket",
                  "provision", "deprovision",
                  "1)", "(1)", "step 1", "(a)", "first step",
                  "handoff", "sign-off", "sign off", "sign_off")
    ) and not any(
        # Exclude if also matches "must/shall" predominance (policy wins)
        w in text_lower for w in ("prohibited", "policy shall", "must comply")
    ):
        layer = PyramidLayer.PROCEDURE

    # POLICY — rules and requirements
    elif any(
        w in text_lower
        for w in ("must", "shall", "prohibited", "required", "policy",
                  "mandatory", "forbidden", "allowed only", "not allowed",
                  "must not", "is required")
    ):
        layer = PyramidLayer.POLICY

    else:
        layer = PyramidLayer.POLICY

    return ClassifiedChunk(
        chunk_id=chunk_id,
        text=text,
        inferred_layer=layer,
        confidence=0.5,
        rationale="Heuristic classification (template_only mode — no AI).",
    )


def _template_policy(
    subject: str,
    anchors: list[NormativeAnchor],
    framework: str,
) -> DraftPolicy:
    """Minimal template policy for degraded mode."""
    refs = [f"{a.framework} {a.clause}" for a in anchors] or [framework]
    return DraftPolicy(
        title=f"{subject.title()} Policy",
        scope="All systems and personnel handling in-scope assets.",
        purpose=f"Define requirements for {subject} in compliance with {framework}.",
        requirements=[
            f"The organisation MUST implement controls addressing {subject}.",
            "Compliance status MUST be reviewed at least annually.",
        ],
        normative_references=refs,
        review_cycle_months=12,
        layer=PyramidLayer.POLICY,
    )
