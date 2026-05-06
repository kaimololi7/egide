"""
Tool: validate

Runs deterministic validation rules against a pyramid artifact before
persistence. Calls the validator service (Go, 25 rules, SQL CTE).

This is the final gate before any generated artifact is written to the DB.
Cf. ADR 006 (graph persistence) + ADR 015 (hexagonal validator).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..models import ValidationIssue, ValidationResult

logger = logging.getLogger(__name__)


async def validate(
    pyramid_id: str,
    artifact: dict[str, Any],
    *,
    validator_api_url: str,
    tenant_id: str,
    trace_id: str | None = None,
) -> ValidationResult:
    """
    Submit a pyramid artifact to the validator service for deterministic checks.

    Args:
        pyramid_id:        UUID of the pyramid.
        artifact:          JSON payload of the artifact to validate.
        validator_api_url: Base URL of the validator service.
        tenant_id:         Tenant UUID.
        trace_id:          Distributed trace ID.

    Returns:
        ValidationResult with pass/fail and list of issues.

    Raises:
        httpx.HTTPError: on network failure (caller should handle).
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if trace_id:
        headers["X-Trace-Id"] = trace_id
    headers["X-Tenant-Id"] = tenant_id

    payload = {
        "pyramid_id": pyramid_id,
        "artifact": artifact,
        "tenant_id": tenant_id,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{validator_api_url}/v1/validate",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()

    raw: dict[str, Any] = response.json()

    issues = [
        ValidationIssue(
            rule_id=i["rule_id"],
            description=i["description"],
            severity=i["severity"],
            affected_node_id=i.get("affected_node_id"),
        )
        for i in raw.get("issues", [])
    ]

    passed = raw.get("passed", False)
    rules_evaluated = raw.get("rules_evaluated", 0)
    rules_passed = raw.get("rules_passed", 0)

    logger.info(
        "validate: passed=%s issues=%d rules=%d/%d",
        passed,
        len(issues),
        rules_passed,
        rules_evaluated,
        extra={"tenant_id": tenant_id, "trace_id": trace_id, "pyramid_id": pyramid_id},
    )

    return ValidationResult(
        pyramid_id=pyramid_id,
        passed=passed,
        issues=issues,
        rules_evaluated=rules_evaluated,
        rules_passed=rules_passed,
    )
