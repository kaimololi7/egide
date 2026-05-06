"""CircuitBreaker — provider failure isolation (port from aegis-platform).

Three states: CLOSED → OPEN → HALF_OPEN → (CLOSED | OPEN).

Used by LLMRouterClient to isolate failing providers and trigger
fallback (e.g., switch to local Ollama when Anthropic is down).

Cf. threat-models/llm-router.md §DoS / Cost exhaustion.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import Enum
from typing import TypeVar

from agents_common.errors import CircuitBreakerOpenError

T = TypeVar("T")


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    """Tunable thresholds. Sensible defaults for LLM provider isolation."""

    failure_threshold: int = 5
    """Open after N consecutive failures."""

    success_threshold: int = 2
    """Close from half-open after N consecutive successes."""

    timeout_s: float = 30.0
    """Seconds to wait before transitioning OPEN → HALF_OPEN."""


class CircuitBreaker:
    """Async circuit breaker with state machine.

    Status: scaffold. Full integration with LLMRouterClient lands at M1 S2.
    """

    def __init__(
        self,
        name: str,
        config: CircuitBreakerConfig | None = None,
    ) -> None:
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._opened_at: float | None = None
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    async def call(
        self,
        func: Callable[[], Awaitable[T]],
    ) -> T:
        """Call `func` through the circuit. Raises CircuitBreakerOpenError if open."""
        async with self._lock:
            if self._state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self._state = CircuitState.HALF_OPEN
                else:
                    raise CircuitBreakerOpenError(self.name)
        try:
            result = await func()
        except Exception:
            await self._on_failure()
            raise
        await self._on_success()
        return result

    def _should_attempt_reset(self) -> bool:
        if self._opened_at is None:
            return True
        return time.monotonic() - self._opened_at >= self.config.timeout_s

    async def _on_success(self) -> None:
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.config.success_threshold:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    self._opened_at = None
            elif self._state == CircuitState.CLOSED:
                self._failure_count = 0

    async def _on_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            self._success_count = 0
            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                self._opened_at = time.monotonic()
            elif (
                self._state == CircuitState.CLOSED
                and self._failure_count >= self.config.failure_threshold
            ):
                self._state = CircuitState.OPEN
                self._opened_at = time.monotonic()
