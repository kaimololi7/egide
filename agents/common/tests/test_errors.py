"""Tests for typed errors — code/retryable invariants matter for the
LLM Router router decision logic."""

from __future__ import annotations

from agents_common.errors import (
    AgentError,
    BudgetExceededError,
    CircuitBreakerOpenError,
    HallucinationDetectedError,
    LLMRouterError,
    ToolValidationError,
)


def test_agent_error_is_base_class() -> None:
    for cls in (
        LLMRouterError,
        ToolValidationError,
        HallucinationDetectedError,
        CircuitBreakerOpenError,
        BudgetExceededError,
    ):
        assert issubclass(cls, AgentError)


def test_error_codes_are_unique_and_stable() -> None:
    codes = {
        AgentError.code,
        LLMRouterError.code,
        ToolValidationError.code,
        HallucinationDetectedError.code,
        CircuitBreakerOpenError.code,
        BudgetExceededError.code,
    }
    assert len(codes) == 6


def test_retryable_flags_match_router_policy() -> None:
    # The LLM Router will retry these.
    assert LLMRouterError.retryable is True
    assert ToolValidationError.retryable is True
    assert HallucinationDetectedError.retryable is True
    # And NOT these.
    assert CircuitBreakerOpenError.retryable is False
    assert BudgetExceededError.retryable is False


def test_circuit_open_error_carries_circuit_name() -> None:
    err = CircuitBreakerOpenError("anthropic")
    assert err.details["circuit"] == "anthropic"
    assert "anthropic" in str(err)


def test_agent_error_details_round_trip() -> None:
    err = AgentError("boom", attempt=3, provider="ollama")
    assert err.details == {"attempt": 3, "provider": "ollama"}
