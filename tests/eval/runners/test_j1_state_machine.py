"""
J1 state machine unit tests (cf. ADR 011).

No LLM, no NATS, no DB — pure state transition tests.

Run:
  uv run pytest tests/eval/runners/test_j1_state_machine.py -v
"""

from __future__ import annotations

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "agents" / "orchestrator" / "src"))

from agents_orchestrator.j1_state_machine import (  # noqa: E402
    J1Phase,
    J1State,
    J1StateMachine,
)


def _machine() -> J1StateMachine:
    state = J1State(
        pyramid_id="test-pyramid-id",
        tenant_id="test-tenant-id",
        trace_id="test-trace-id",
        framework="ISO27001:2022",
    )
    return J1StateMachine(state)


def test_initial_phase():
    m = _machine()
    assert m.state.phase == J1Phase.INGESTED


def test_not_terminal_initially():
    m = _machine()
    assert not m.is_terminal()


def test_set_chunks_transitions_to_classifying():
    m = _machine()
    m.set_chunks([{"chunk_id": "c1", "text": "some text"}])
    assert m.state.phase == J1Phase.CLASSIFYING
    assert len(m.state.chunks) == 1


def test_set_anchors_transitions_to_drafting():
    m = _machine()
    m.set_chunks([{"chunk_id": "c1", "text": "text"}])
    m.set_anchors([{"anchor_id": "a1"}])
    assert m.state.phase == J1Phase.DRAFTING


def test_set_drafts_transitions_to_validating():
    m = _machine()
    m.set_chunks([])
    m.set_anchors([])
    m.set_drafts([{"title": "Policy X"}])
    assert m.state.phase == J1Phase.VALIDATING


def test_validation_passed_transitions_to_storing():
    m = _machine()
    m.set_chunks([])
    m.set_anchors([])
    m.set_drafts([])
    m.set_validation({"passed": True})
    assert m.state.phase == J1Phase.STORING


def test_validation_failed_transitions_to_failed():
    m = _machine()
    m.set_chunks([])
    m.set_anchors([])
    m.set_drafts([])
    m.set_validation({"passed": False})
    assert m.state.phase == J1Phase.FAILED
    assert m.state.error is not None
    assert m.is_terminal()


def test_mark_done():
    m = _machine()
    m.set_chunks([])
    m.set_anchors([])
    m.set_drafts([])
    m.set_validation({"passed": True})
    m.mark_done()
    assert m.state.phase == J1Phase.DONE
    assert m.is_terminal()


def test_mark_failed_directly():
    m = _machine()
    m.mark_failed("network error")
    assert m.state.phase == J1Phase.FAILED
    assert m.state.error == "network error"
    assert m.is_terminal()


def test_terminal_states():
    assert J1Phase.DONE in (J1Phase.DONE, J1Phase.FAILED)
    assert J1Phase.FAILED in (J1Phase.DONE, J1Phase.FAILED)
    assert J1Phase.INGESTED not in (J1Phase.DONE, J1Phase.FAILED)
