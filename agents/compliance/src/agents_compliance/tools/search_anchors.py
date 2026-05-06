"""
Tool: search_anchors

Searches the normative RAG index (pgvector) for clauses matching a query.
Called by the super-agent before drafting any artifact to ground citations.

Cf. ADR 007 (RAG normative) + ADR 014 §LLM09 (hallucination guard requires anchors).
Every generated artifact MUST cite at least one anchor returned by this tool.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..models import NormativeAnchor

logger = logging.getLogger(__name__)

# Maximum anchors returned per query to limit context window usage.
MAX_ANCHORS = 10


async def search_anchors(
    query: str,
    *,
    frameworks: list[str] | None = None,
    top_k: int = 5,
    validator_api_url: str,
    tenant_id: str,
    trace_id: str | None = None,
) -> list[NormativeAnchor]:
    """
    Query the normative RAG index for relevant framework clauses.

    Args:
        query:           Natural-language query describing the control or requirement.
        frameworks:      Optional filter to specific frameworks (e.g., ["ISO27001:2022"]).
        top_k:           Number of top results to return (max MAX_ANCHORS).
        validator_api_url: Base URL of the validator service.
        tenant_id:       Tenant UUID for scoping.
        trace_id:        Distributed trace ID for audit logging.

    Returns:
        List of NormativeAnchor sorted by similarity_score descending.
    """
    top_k = min(top_k, MAX_ANCHORS)

    params: dict[str, Any] = {
        "q": query,
        "top_k": top_k,
        "tenant_id": tenant_id,
    }
    if frameworks:
        params["frameworks"] = ",".join(frameworks)

    headers: dict[str, str] = {}
    if trace_id:
        headers["X-Trace-Id"] = trace_id

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{validator_api_url}/v1/rag/search",
            params=params,
            headers=headers,
        )
        response.raise_for_status()

    raw: list[dict[str, Any]] = response.json()
    anchors = [NormativeAnchor(**item) for item in raw]

    logger.info(
        "search_anchors: found %d results",
        len(anchors),
        extra={"tenant_id": tenant_id, "trace_id": trace_id, "query": query[:80]},
    )
    return anchors
