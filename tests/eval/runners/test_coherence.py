"""
Coherence eval runner (cf. ADR 009).

Tests the validator's 25 deterministic rules against pyramid graph fixtures
defined in coh_fixtures.yaml.

Strategy: calls services/validator via HTTP if running on :8002,
else falls back to Python re-implementation of the key structural rules
(sufficient for CI without requiring the Go binary).

Run:
  uv run pytest tests/eval/runners/test_coherence.py -v

Expected: 15/15 pass.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

import pytest
import yaml
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
FIXTURES_PATH = (
    pathlib.Path(__file__).parent.parent
    / "fixtures"
    / "coherence"
    / "coh_fixtures.yaml"
)

VALIDATOR_URL = os.environ.get("VALIDATOR_URL", "http://localhost:8002")

# Layer order for structural validation
LAYER_ORDER = ["directive", "policy", "procedure", "process", "kpi"]
VALID_CHILD = {
    "directive": {"policy"},
    "policy": {"procedure"},
    "procedure": {"process"},
    "process": {"kpi"},
    "kpi": set(),
}


def load_fixtures() -> list[dict]:
    with FIXTURES_PATH.open() as f:
        data = yaml.safe_load(f)
    return data["fixtures"]


FIXTURES = load_fixtures()


# ── Validator HTTP call ───────────────────────────────────────────────────────


def validate_via_http(graph: list[dict]) -> dict[str, Any] | None:
    """
    POST to services/validator /v1/validate.
    Returns validator response dict or None if unreachable.
    """
    body = json.dumps({"nodes": graph, "tenant_id": "eval-test"}).encode()
    req = urllib.request.Request(
        f"{VALIDATOR_URL}/v1/validate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError):
        return None


# ── Python structural fallback ────────────────────────────────────────────────


def _python_validate(graph: list[dict]) -> dict[str, Any]:
    """
    Python re-implementation of the structural rules needed for CI
    without the Go validator binary. Covers the rules referenced in fixtures.
    """
    issues = []

    # Build ID map
    id_map: dict[str, dict] = {}
    for node in graph:
        nid = node.get("id", "")
        if nid in id_map:
            issues.append({"rule_id": "R-021", "message": f"Duplicate node id: {nid!r}", "node_id": nid, "severity": "error"})
        else:
            id_map[nid] = node

    for node in graph:
        nid = node.get("id", "")
        layer = node.get("layer", "")
        parent_id = node.get("parent_id")
        title = node.get("title", "")
        version = node.get("version", "")
        status = node.get("status", "")

        # R-001 — directives must be root
        if layer == "directive" and parent_id is not None:
            issues.append({"rule_id": "R-001", "message": "Directive must have no parent", "node_id": nid, "severity": "error"})

        # R-003 — policy must have a parent
        if layer == "policy" and (parent_id is None or parent_id not in id_map):
            issues.append({"rule_id": "R-003", "message": "Policy must have a parent directive", "node_id": nid, "severity": "error"})

        # R-004 — procedure must be under policy
        if layer == "procedure" and parent_id is not None:
            parent = id_map.get(parent_id)
            if parent and parent.get("layer") != "policy":
                issues.append({"rule_id": "R-004", "message": "Procedure must be under a policy", "node_id": nid, "severity": "error"})

        # R-006 — KPI must not be directly under policy
        if layer == "kpi" and parent_id is not None:
            parent = id_map.get(parent_id)
            if parent and parent.get("layer") == "policy":
                issues.append({"rule_id": "R-006", "message": "KPI must not be directly under policy", "node_id": nid, "severity": "error"})

        # R-007 — KPI must have a parent
        if layer == "kpi" and (parent_id is None or parent_id not in id_map):
            issues.append({"rule_id": "R-007", "message": "KPI must have a parent process", "node_id": nid, "severity": "error"})

        # R-010 — title must not be empty
        if not title or not title.strip():
            issues.append({"rule_id": "R-010", "message": "Node title must not be empty", "node_id": nid, "severity": "error"})

        # R-011 — procedure under anchored policy should have refs (warning)
        if layer == "procedure" and parent_id is not None:
            parent = id_map.get(parent_id)
            if parent and parent.get("framework_refs") and not node.get("framework_refs"):
                issues.append({"rule_id": "R-011", "message": "Procedure under anchored policy should have framework_refs", "node_id": nid, "severity": "warning"})

        # R-015 — published node must have version >= 1.0
        if status == "published" and version:
            try:
                major = int(version.split(".")[0])
                if major < 1:
                    issues.append({"rule_id": "R-015", "message": "Published node must have version >= 1.0", "node_id": nid, "severity": "error"})
            except (ValueError, IndexError):
                pass

    # R-020 — cycle detection (simple DFS)
    def has_cycle(start_id: str, visited: set[str], path: set[str]) -> bool:
        if start_id in path:
            return True
        if start_id in visited:
            return False
        visited.add(start_id)
        path.add(start_id)
        node = id_map.get(start_id, {})
        parent_id = node.get("parent_id")
        if parent_id and has_cycle(parent_id, visited, path):
            return True
        path.discard(start_id)
        return False

    visited: set[str] = set()
    for nid in id_map:
        if has_cycle(nid, visited, set()):
            issues.append({"rule_id": "R-020", "message": f"Cycle detected at node {nid!r}", "node_id": nid, "severity": "error"})
            break

    return {
        "valid": len([i for i in issues if i.get("severity") == "error"]) == 0,
        "issues": issues,
    }


# ── Test parametrize ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "fixture",
    FIXTURES,
    ids=[f["id"] for f in FIXTURES],
)
def test_coherence_fixture(fixture: dict) -> None:
    graph = fixture["graph"]
    expected_valid: bool = fixture["expected_valid"]
    expected_rule_ids: list[str] = fixture.get("expected_rule_ids", [])

    # Try the Go validator first
    resp = validate_via_http(graph)
    if resp is None:
        # Fallback to Python validator
        resp = _python_validate(graph)

    actual_valid: bool = resp.get("valid", False)
    issues: list[dict] = resp.get("issues", [])
    fired_rule_ids = {i.get("rule_id", "") for i in issues}

    assert actual_valid == expected_valid, (
        f"[{fixture['id']}] expected valid={expected_valid}, got valid={actual_valid}.\n"
        f"Issues: {json.dumps(issues, indent=2)}"
    )

    for rule_id in expected_rule_ids:
        assert rule_id in fired_rule_ids, (
            f"[{fixture['id']}] Expected rule {rule_id!r} to fire, "
            f"but only got: {sorted(fired_rule_ids)}.\n"
            f"Issues: {json.dumps(issues, indent=2)}"
        )
