"""Typed errors for AI workers — mirror packages/llm-router/src/errors.ts."""

from __future__ import annotations


class AgentError(Exception):
    """Base error for all AI worker errors."""

    code: str = "AGENT_ERROR"
    retryable: bool = False

    def __init__(self, message: str, **details: object) -> None:
        super().__init__(message)
        self.details = details


class LLMRouterError(AgentError):
    """Error raised when LLMRouterClient call fails."""

    code = "LLM_ROUTER_ERROR"
    retryable = True


class ToolValidationError(AgentError):
    """LLM produced a tool output that failed Pydantic validation (LLM05)."""

    code = "TOOL_VALIDATION_FAILED"
    retryable = True


class HallucinationDetectedError(AgentError):
    """LLM cited an anchor that does not exist in ontology (Q01)."""

    code = "HALLUCINATION_DETECTED"
    retryable = True

    def __init__(self, invalid_anchors: list[str]) -> None:
        super().__init__(
            f"LLM output cited unknown anchors: {', '.join(invalid_anchors)}",
            invalid_anchors=invalid_anchors,
        )
        self.invalid_anchors = invalid_anchors


class CircuitBreakerOpenError(AgentError):
    """Circuit breaker is open — caller should fall back."""

    code = "CIRCUIT_OPEN"
    retryable = False

    def __init__(self, name: str) -> None:
        super().__init__(f"Circuit breaker {name} is open", circuit=name)


class BudgetExceededError(AgentError):
    """Per-tenant LLM budget cap reached (LLM10)."""

    code = "BUDGET_EXCEEDED"
    retryable = False
