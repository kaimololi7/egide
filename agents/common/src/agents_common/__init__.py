"""Egide AI workers common library (cf. ADR 011).

Provides:
- PydanticAI agent framework wiring
- CircuitBreaker (port from aegis-platform)
- LLMRouterClient adapter to apps/api LLM Router
- Audit trail wrapper for llm_calls (ADR 014 §A09)
- Hallucination guard (Q01) verifying anchor refs

Status: scaffold. Full implementations land at M1 sprint S2.
"""

from agents_common.audit import AuditContext, AuditedToolWrapper
from agents_common.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitState,
)
from agents_common.errors import (
    AgentError,
    HallucinationDetectedError,
    LLMRouterError,
    ToolValidationError,
)
from agents_common.hallucination_guard import HallucinationGuard
from agents_common.llm_router_client import LLMRouterClient

__version__ = "0.0.1"

__all__ = [
    "AgentError",
    "AuditContext",
    "AuditedToolWrapper",
    "CircuitBreaker",
    "CircuitBreakerOpenError",
    "CircuitState",
    "HallucinationDetectedError",
    "HallucinationGuard",
    "LLMRouterClient",
    "LLMRouterError",
    "ToolValidationError",
]
