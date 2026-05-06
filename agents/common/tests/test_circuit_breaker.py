"""Tests for CircuitBreaker — failure isolation state machine.

Cf. agents_common.circuit_breaker. Verifies CLOSED → OPEN → HALF_OPEN →
CLOSED transitions, threshold counting, and timeout-based reset.
"""

from __future__ import annotations

import asyncio

import pytest
from agents_common.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitState,
)
from agents_common.errors import CircuitBreakerOpenError


@pytest.fixture
def config() -> CircuitBreakerConfig:
    """Tight config so tests run fast."""
    return CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=2,
        timeout_s=0.05,
    )


async def _ok() -> str:
    return "ok"


async def _fail() -> str:
    raise RuntimeError("provider down")


async def test_initial_state_is_closed(config: CircuitBreakerConfig) -> None:
    cb = CircuitBreaker("test", config)
    assert cb.state is CircuitState.CLOSED


async def test_successful_calls_keep_circuit_closed(
    config: CircuitBreakerConfig,
) -> None:
    cb = CircuitBreaker("test", config)
    for _ in range(5):
        assert await cb.call(_ok) == "ok"
    assert cb.state is CircuitState.CLOSED


async def test_consecutive_failures_open_circuit(
    config: CircuitBreakerConfig,
) -> None:
    cb = CircuitBreaker("test", config)
    for _ in range(config.failure_threshold):
        with pytest.raises(RuntimeError):
            await cb.call(_fail)
    assert cb.state is CircuitState.OPEN


async def test_open_circuit_rejects_calls_immediately(
    config: CircuitBreakerConfig,
) -> None:
    cb = CircuitBreaker("test", config)
    for _ in range(config.failure_threshold):
        with pytest.raises(RuntimeError):
            await cb.call(_fail)
    # Now open — _ok should never run.
    with pytest.raises(CircuitBreakerOpenError):
        await cb.call(_ok)


async def test_intermixed_success_resets_failure_count(
    config: CircuitBreakerConfig,
) -> None:
    """A success between failures resets the failure tally in CLOSED state."""
    cb = CircuitBreaker("test", config)
    # 2 failures (under threshold)
    for _ in range(2):
        with pytest.raises(RuntimeError):
            await cb.call(_fail)
    # 1 success → resets count
    await cb.call(_ok)
    # 2 more failures should NOT trip (threshold=3, count was reset)
    for _ in range(2):
        with pytest.raises(RuntimeError):
            await cb.call(_fail)
    assert cb.state is CircuitState.CLOSED


async def test_open_to_half_open_after_timeout(
    config: CircuitBreakerConfig,
) -> None:
    cb = CircuitBreaker("test", config)
    for _ in range(config.failure_threshold):
        with pytest.raises(RuntimeError):
            await cb.call(_fail)
    assert cb.state is CircuitState.OPEN

    await asyncio.sleep(config.timeout_s + 0.01)

    # First call after timeout transitions OPEN → HALF_OPEN and runs.
    assert await cb.call(_ok) == "ok"
    assert cb.state is CircuitState.HALF_OPEN


async def test_half_open_closes_after_success_threshold(
    config: CircuitBreakerConfig,
) -> None:
    cb = CircuitBreaker("test", config)
    for _ in range(config.failure_threshold):
        with pytest.raises(RuntimeError):
            await cb.call(_fail)
    await asyncio.sleep(config.timeout_s + 0.01)

    for _ in range(config.success_threshold):
        await cb.call(_ok)
    assert cb.state is CircuitState.CLOSED


async def test_half_open_reopens_on_single_failure(
    config: CircuitBreakerConfig,
) -> None:
    cb = CircuitBreaker("test", config)
    for _ in range(config.failure_threshold):
        with pytest.raises(RuntimeError):
            await cb.call(_fail)
    await asyncio.sleep(config.timeout_s + 0.01)

    # Probe call fails → straight back to OPEN.
    with pytest.raises(RuntimeError):
        await cb.call(_fail)
    assert cb.state is CircuitState.OPEN


async def test_concurrent_calls_share_state(config: CircuitBreakerConfig) -> None:
    """The internal lock serialises state mutations; concurrent failures
    accumulate against the same threshold."""
    cb = CircuitBreaker("test", config)

    async def fail_once() -> None:
        with pytest.raises(RuntimeError):
            await cb.call(_fail)

    await asyncio.gather(*(fail_once() for _ in range(config.failure_threshold)))
    assert cb.state is CircuitState.OPEN
