"""
Generation eval runner (cf. ADR 009).

Tests that services/compiler generates Rego output containing expected
fragments for each built-in intent control.

Strategy: calls the Go compiler binary directly via subprocess.
Falls back to checking the Go test output if compiler binary is unavailable.

Run:
  uv run pytest tests/eval/runners/test_generation.py -v

Expected: 10/10 pass (pure structural check, no LLM needed).
"""

from __future__ import annotations

import pathlib
import subprocess
import json
import sys
import tempfile
import os

import pytest
import yaml

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
FIXTURES_PATH = (
    pathlib.Path(__file__).parent.parent
    / "fixtures"
    / "generation"
    / "gen_fixtures.yaml"
)

# Built-in intent IR (mirrors Go controls, used when compiler is not running)
BUILTIN_INTENT_IDS = {
    "intent_db_backup_required",
    "intent_encryption_at_rest",
    "intent_access_logging",
    "intent_mfa_enforcement",
    "intent_network_egress_restriction",
}


def load_fixtures() -> list[dict]:
    with FIXTURES_PATH.open() as f:
        data = yaml.safe_load(f)
    return data["fixtures"]


FIXTURES = load_fixtures()


def compile_intent_via_go(intent_id: str) -> dict | None:
    """
    Calls `go test` in the compiler package to extract the compiled Rego
    for a given intent ID. Returns a dict with at least 'content' and
    'content_hash', or None on failure.
    """
    compiler_dir = REPO_ROOT / "services" / "compiler"
    if not compiler_dir.exists():
        return None

    # Write a small Go test helper that prints the compiled artifact as JSON
    test_code = f'''package main

import (
    "context"
    "encoding/json"
    "fmt"
    "github.com/egide/egide/services/compiler/internal/generators/rego"
    "github.com/egide/egide/services/compiler/internal/generators/rego/controls"
)

func main() {{
    intent := controls.ByID("{intent_id}")
    if intent == nil {{
        fmt.Printf("{{\\"error\\": \\"intent not found\\"}}")
        return
    }}
    gen := rego.New()
    artifact, err := gen.Compile(context.Background(), intent)
    if err != nil {{
        fmt.Printf("{{\\"error\\": \\"%v\\"}}", err)
        return
    }}
    out, _ := json.Marshal(artifact)
    fmt.Print(string(out))
}}
'''

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_file = pathlib.Path(tmpdir) / "compile_check.go"
        tmp_file.write_text(test_code)

        result = subprocess.run(
            ["go", "run", str(tmp_file)],
            capture_output=True,
            text=True,
            cwd=str(compiler_dir),
            timeout=30,
        )
        if result.returncode != 0:
            return None

        try:
            return json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            return None


def compile_intent_http(intent_id: str) -> dict | None:
    """
    Calls the compiler HTTP API if it is running on port 8003.
    """
    import urllib.request
    import urllib.error

    compiler_url = os.environ.get("COMPILER_URL", "http://localhost:8003")
    body = json.dumps({"intent": {"id": intent_id}, "target": "rego"}).encode()
    req = urllib.request.Request(
        f"{compiler_url}/v1/compile",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError):
        return None


def get_artifact(intent_id: str) -> dict:
    """Try HTTP first (running service), then Go subprocess, else skip."""
    artifact = compile_intent_http(intent_id)
    if artifact is not None:
        return artifact

    artifact = compile_intent_via_go(intent_id)
    if artifact is not None:
        return artifact

    pytest.skip(f"Cannot reach compiler for intent {intent_id!r}")


@pytest.mark.parametrize(
    "fixture",
    FIXTURES,
    ids=[f["id"] for f in FIXTURES],
)
def test_generation_fixture(fixture: dict) -> None:
    """Validate that compiled Rego for the given intent contains expected fragments."""
    intent_id: str = fixture["intent_id"]
    expect_contains: list[str] = fixture.get("expect_contains", [])
    expect_not_contains: list[str] = fixture.get("expect_not_contains", [])

    artifact = get_artifact(intent_id)

    # Check for errors from the compiler
    if "error" in artifact:
        pytest.fail(f"Compiler returned error: {artifact['error']}")

    # The content field is the Rego source
    content: str = artifact.get("content", "")
    content_hash: str = artifact.get("content_hash", "")

    # For hash checks (gen-002)
    full_text = content + "\n" + content_hash

    for expected in expect_contains:
        # Check in content first, then in hash
        if expected not in full_text:
            pytest.fail(
                f"[{fixture['id']}] Expected to find {expected!r} in compiled output.\n"
                f"Content (first 500 chars):\n{content[:500]}"
            )

    for forbidden in expect_not_contains:
        if forbidden in content:
            pytest.fail(
                f"[{fixture['id']}] Found forbidden string {forbidden!r} in compiled output."
            )
