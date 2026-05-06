"""Tests for AuditContext + AuditedToolWrapper.

These cover the public dataclass invariants and the `with_extra` builder.
The persistence layer (record() POST/NATS) is a scaffold and tested
behaviorally only — it must complete without raising.
"""

from __future__ import annotations

from agents_common.audit import AuditContext, AuditedToolWrapper


def test_audit_context_minimum_fields() -> None:
    ctx = AuditContext(tenant_id="t-1")
    assert ctx.tenant_id == "t-1"
    assert ctx.pyramid_id is None
    assert ctx.actor_id is None


def test_audit_context_full_fields() -> None:
    ctx = AuditContext(
        tenant_id="t-1",
        actor_id="u-7",
        pyramid_id="p-9",
        journey_phase="j1.classify",
        worker_name="agents.compliance",
        trace_id="trace-abc",
    )
    assert ctx.journey_phase == "j1.classify"
    assert ctx.worker_name == "agents.compliance"


def test_with_extra_overrides_pyramid_id() -> None:
    base = AuditContext(tenant_id="t-1", pyramid_id="p-1")
    wrapper = AuditedToolWrapper("draft_policy", base)
    extended = wrapper.with_extra(pyramid_id="p-2")
    # New pyramid_id, but tenant + trace preserved.
    assert extended.pyramid_id == "p-2"
    assert extended.tenant_id == "t-1"
    # Original context untouched (immutable semantics).
    assert base.pyramid_id == "p-1"


def test_with_extra_falls_back_to_existing_context() -> None:
    base = AuditContext(
        tenant_id="t-1",
        journey_phase="j1.classify",
        worker_name="agents.compliance",
    )
    wrapper = AuditedToolWrapper("draft_policy", base)
    extended = wrapper.with_extra()
    assert extended.journey_phase == "j1.classify"
    assert extended.worker_name == "agents.compliance"


async def test_record_is_callable_without_raising() -> None:
    """Scaffold check — record() will POST to /v1/llm/audit at M1 S2.
    For now we only verify the signature/shape stays stable."""
    ctx = AuditContext(tenant_id="t-1")
    wrapper = AuditedToolWrapper("draft_policy", ctx)
    await wrapper.record(
        provider="ollama",
        model="mistral:7b-instruct",
        task_type="classify",
        input_tokens=120,
        output_tokens=40,
        est_cost_micro_usd=0,
        latency_ms=180,
        cache_hit=False,
        success=True,
        error_code=None,
    )
