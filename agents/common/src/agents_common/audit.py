"""Audit context and tool wrapper.

Every LLM call from an AI worker carries an AuditContext that flows
through to the llm_calls table (cf. ADR 014 §A09).

Every tool decorated with @audited_tool emits a row to llm_calls
including pyramid_id, journey_phase, worker_name, cache_hit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class AuditContext:
    """Mandatory on every LLM call from AI workers.

    Mirrors packages/llm-router/src/types.ts AuditContext.
    """

    tenant_id: str
    actor_id: str | None = None
    pyramid_id: str | None = None
    journey_phase: str | None = None  # "j1.classify" | "j3.compile" | ...
    worker_name: str | None = None  # "agents.compliance" | "agents.orchestrator"
    trace_id: str | None = None


class AuditedToolWrapper:
    """Wraps a PydanticAI tool to emit an audit log entry per invocation.

    Status: scaffold. Wiring to llm_calls table lands at M1 S2.
    """

    def __init__(self, tool_name: str, audit_context: AuditContext) -> None:
        self.tool_name = tool_name
        self.audit_context = audit_context

    async def record(
        self,
        *,
        provider: str,
        model: str,
        task_type: str,
        input_tokens: int,
        output_tokens: int,
        est_cost_micro_usd: int,
        latency_ms: int,
        cache_hit: bool,
        success: bool,
        error_code: str | None = None,
    ) -> None:
        """Emit an audit entry. Implementation persists via httpx to /llm/audit."""
        _ = (
            provider,
            model,
            task_type,
            input_tokens,
            output_tokens,
            est_cost_micro_usd,
            latency_ms,
            cache_hit,
            success,
            error_code,
        )
        # TODO M1 S2: POST to apps/api /v1/llm/audit, or publish on
        # NATS subject egide.v1.llm.calls.

    def with_extra(self, **fields: Any) -> AuditContext:  # noqa: ANN401
        """Build a new AuditContext extended with extra fields."""
        return AuditContext(
            tenant_id=self.audit_context.tenant_id,
            actor_id=self.audit_context.actor_id,
            pyramid_id=fields.get("pyramid_id", self.audit_context.pyramid_id),
            journey_phase=fields.get(
                "journey_phase", self.audit_context.journey_phase
            ),
            worker_name=fields.get("worker_name", self.audit_context.worker_name),
            trace_id=self.audit_context.trace_id,
        )
