"""
J1 journey state machine: Drop Docs → Pyramid Generation.

Orchestrates the full pipeline:
  ingested → classified → anchored → drafted → validated → stored

State transitions are deterministic; LLM work is delegated to
agents/compliance tools. Cf. ADR 011 (orchestration is NOT AI-driven).

NATS subjects consumed/produced (cf. ADR 008, prefix egide.v1.*):
  CONSUME: egide.v1.extractor.completed  (extraction done, chunks ready)
  PUBLISH: egide.v1.pyramid.requested    (trigger compliance super-agent)
  PUBLISH: egide.v1.pyramid.generated    (pyramid artifact ready)
  PUBLISH: egide.v1.pyramid.failed       (unrecoverable error)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any

logger = logging.getLogger(__name__)


class J1Phase(Enum):
    """Ordered phases of the J1 journey."""

    INGESTED = auto()
    CLASSIFYING = auto()
    ANCHORING = auto()
    DRAFTING = auto()
    VALIDATING = auto()
    STORING = auto()
    DONE = auto()
    FAILED = auto()


@dataclass
class J1State:
    """Mutable state for a single J1 run."""

    pyramid_id: str
    tenant_id: str
    trace_id: str
    framework: str
    phase: J1Phase = J1Phase.INGESTED
    chunks: list[dict[str, Any]] = field(default_factory=list)
    anchors: list[dict[str, Any]] = field(default_factory=list)
    draft_policies: list[dict[str, Any]] = field(default_factory=list)
    validation_result: dict[str, Any] | None = None
    error: str | None = None


class J1StateMachine:
    """
    Plain Python state machine for J1: Drop Docs → Pyramid.

    Each `advance()` call moves the state one phase forward.
    Transitions are synchronous with respect to the orchestrator loop;
    the orchestrator awaits each async phase before calling advance() again.

    This class is intentionally NOT an AI agent.
    """

    def __init__(self, state: J1State) -> None:
        self.state = state

    def is_terminal(self) -> bool:
        return self.state.phase in (J1Phase.DONE, J1Phase.FAILED)

    def mark_failed(self, reason: str) -> None:
        logger.error(
            "J1 failed: %s",
            reason,
            extra={
                "pyramid_id": self.state.pyramid_id,
                "tenant_id": self.state.tenant_id,
                "phase": self.state.phase.name,
            },
        )
        self.state.error = reason
        self.state.phase = J1Phase.FAILED

    def transition(self, to: J1Phase) -> None:
        logger.info(
            "J1 transition: %s → %s",
            self.state.phase.name,
            to.name,
            extra={
                "pyramid_id": self.state.pyramid_id,
                "tenant_id": self.state.tenant_id,
            },
        )
        self.state.phase = to

    def set_chunks(self, chunks: list[dict[str, Any]]) -> None:
        self.state.chunks = chunks
        self.transition(J1Phase.CLASSIFYING)

    def set_anchors(self, anchors: list[dict[str, Any]]) -> None:
        self.state.anchors = anchors
        self.transition(J1Phase.DRAFTING)

    def set_drafts(self, policies: list[dict[str, Any]]) -> None:
        self.state.draft_policies = policies
        self.transition(J1Phase.VALIDATING)

    def set_validation(self, result: dict[str, Any]) -> None:
        self.state.validation_result = result
        if result.get("passed"):
            self.transition(J1Phase.STORING)
        else:
            self.mark_failed("Validation failed — see validation_result for details")

    def mark_done(self) -> None:
        self.transition(J1Phase.DONE)
