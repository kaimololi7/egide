"""LLMRouterClient — adapter to apps/api LLM Router.

AI workers never call providers directly. Every LLM call goes through
this client, which POSTs to apps/api /v1/llm/* endpoints. The router
handles audit, budget, rate limit, PII scrubbing, and provider routing.

Cf. ADR 004 (multi-LLM router) + threat-models/llm-router.md.

Status: scaffold. HTTP wiring lands at M1 sprint S2.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from agents_common.audit import AuditContext
from agents_common.circuit_breaker import CircuitBreaker
from agents_common.errors import LLMRouterError


@dataclass(slots=True)
class CompleteRequest:
    system_prompt: str
    messages: list[dict[str, Any]]
    tools: list[dict[str, Any]] | None = None
    temperature: float = 0.0
    max_tokens: int = 4096
    cache_control: str | None = None  # "ephemeral" for Anthropic prompt caching


@dataclass(slots=True)
class CompleteResponse:
    content: str
    tool_uses: list[dict[str, Any]]
    cache_hit: bool
    input_tokens: int
    output_tokens: int
    est_cost_micro_usd: int
    latency_ms: int
    finish_reason: str


class LLMRouterClient:
    """Async HTTP client for the LLM Router.

    Wraps every call in a CircuitBreaker for provider failure isolation.
    """

    def __init__(
        self,
        base_url: str,
        api_token: str,
        circuit: CircuitBreaker | None = None,
        timeout_s: float = 60.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.circuit = circuit or CircuitBreaker("llm_router")
        self.timeout_s = timeout_s
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> LLMRouterClient:
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout_s,
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
        )
        return self

    async def __aexit__(self, *_exc: object) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def complete(
        self,
        task_type: str,
        request: CompleteRequest,
        audit: AuditContext,
    ) -> CompleteResponse:
        """Run a completion through the router.

        Status: scaffold. Implementation lands at M1 S2.
        """
        _ = (task_type, request, audit)
        raise LLMRouterError("LLMRouterClient.complete not yet implemented (M1 S2)")

    async def embed(
        self,
        texts: list[str],
        audit: AuditContext,
    ) -> list[list[float]]:
        """Run an embedding batch through the router.

        Status: scaffold. Implementation lands at M1 S2.
        """
        _ = (texts, audit)
        raise LLMRouterError("LLMRouterClient.embed not yet implemented (M1 S2)")
