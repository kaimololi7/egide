"""Eval matrix runner — compares LLM providers on the J1 drafting task.

Runs the same prompt against multiple providers (Anthropic Sonnet,
Mistral Large, Ollama Mistral 7B) on a shared fixture set, then writes
a markdown + JSON report to `tests/eval/results/`.

Cf. ADR 004 (multi-LLM router), ADR 009 (eval framework), roadmap.md
M5 exit criterion 2 (eval matrix per provider on 50+ fixtures).

Usage:
    uv run python tests/eval/matrix/run_matrix.py \\
        --providers anthropic,mistral,ollama \\
        --fixtures tests/eval/fixtures/classification \\
        --max-cases 50

Required env (per provider chosen):
    EGIDE_API_URL                base URL of running apps/api (default http://localhost:3000)
    EGIDE_ORCHESTRATOR_TOKEN     service-account bearer token with scope llm:complete
    EGIDE_TENANT_ID              tenant UUID for the call

The runner DOES NOT call provider APIs directly — it goes through the
canonical `/v1/llm/complete` endpoint so the audit trail, circuit
breaker, and PII scrub are exercised.
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import os
import pathlib
import statistics
import sys
import time
from typing import Any

import httpx

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
DEFAULT_RESULTS_DIR = REPO_ROOT / "tests" / "eval" / "results"

DEFAULT_PROVIDERS = ["anthropic", "mistral", "ollama"]
DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-5-20250929",
    "mistral": "mistral-large-latest",
    "ollama": "mistral:7b-instruct-q5_K_M",
}

# Common prompt skeleton for the drafting comparison.
SYSTEM = (
    "You are an ISO 27001 / NIS2 policy drafter. Output ONLY valid JSON "
    "matching {\"title\":str,\"sections\":[{\"heading\":str,\"body\":str}]}."
    " Do NOT add commentary."
)


@dataclasses.dataclass
class CaseResult:
    case_id: str
    provider: str
    model: str
    success: bool
    latency_ms: int
    finish_reason: str | None
    est_cost_micro_usd: int | None
    cache_hit: bool
    error: str | None
    json_valid: bool
    section_count: int


def load_cases(path: pathlib.Path, limit: int) -> list[dict[str, Any]]:
    """Load fixture cases. Falls back to a synthetic minimal set."""
    cases: list[dict[str, Any]] = []
    if path.exists() and path.is_dir():
        for f in sorted(path.glob("*.json"))[:limit]:
            try:
                cases.append(json.loads(f.read_text()))
            except Exception:
                continue
    if not cases:
        # Minimal synthetic cases so the matrix can still run.
        cases = [
            {
                "id": f"synthetic-{i:02d}",
                "anchor": "ISO27001:2022 A.5.10",
                "user_prompt": (
                    "Draft a short policy on acceptable use of information assets."
                ),
            }
            for i in range(min(limit, 5))
        ]
    return cases[:limit]


async def call_one(
    client: httpx.AsyncClient,
    api_url: str,
    headers: dict[str, str],
    case: dict[str, Any],
    provider: str,
    model: str,
) -> CaseResult:
    payload = {
        "provider": provider,
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Anchor: {case.get('anchor', '?')}\n\n"
                    f"Brief: {case.get('user_prompt', case.get('text', ''))}"
                ),
            },
        ],
        "max_tokens": 800,
        "temperature": 0.1,
    }
    started = time.perf_counter()
    try:
        resp = await client.post(
            f"{api_url}/v1/llm/complete",
            headers=headers,
            json=payload,
            timeout=60.0,
        )
    except Exception as exc:  # network failure
        return CaseResult(
            case_id=case.get("id", "?"),
            provider=provider,
            model=model,
            success=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            finish_reason=None,
            est_cost_micro_usd=None,
            cache_hit=False,
            error=f"network: {exc!r}",
            json_valid=False,
            section_count=0,
        )

    latency_ms = int((time.perf_counter() - started) * 1000)
    if resp.status_code != 200:
        return CaseResult(
            case_id=case.get("id", "?"),
            provider=provider,
            model=model,
            success=False,
            latency_ms=latency_ms,
            finish_reason=None,
            est_cost_micro_usd=None,
            cache_hit=False,
            error=f"http {resp.status_code}: {resp.text[:200]}",
            json_valid=False,
            section_count=0,
        )

    body = resp.json()
    content = (body.get("content") or "").strip()
    json_valid = False
    section_count = 0
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict) and isinstance(parsed.get("sections"), list):
            json_valid = True
            section_count = len(parsed["sections"])
    except Exception:
        pass

    return CaseResult(
        case_id=case.get("id", "?"),
        provider=provider,
        model=model,
        success=True,
        latency_ms=latency_ms,
        finish_reason=body.get("finish_reason"),
        est_cost_micro_usd=body.get("est_cost_micro_usd"),
        cache_hit=bool(body.get("cache_hit")),
        error=None,
        json_valid=json_valid,
        section_count=section_count,
    )


async def run_matrix(
    api_url: str,
    token: str,
    tenant: str,
    cases: list[dict[str, Any]],
    providers: list[str],
    concurrency: int,
) -> list[CaseResult]:
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Egide-Tenant-Id": tenant,
        "Content-Type": "application/json",
    }
    results: list[CaseResult] = []
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient() as client:
        async def bound(case: dict[str, Any], provider: str) -> None:
            model = DEFAULT_MODELS.get(provider, "default")
            async with sem:
                r = await call_one(client, api_url, headers, case, provider, model)
                results.append(r)

        tasks = [
            bound(case, provider) for case in cases for provider in providers
        ]
        await asyncio.gather(*tasks)
    return results


def summarize(results: list[CaseResult]) -> dict[str, dict[str, Any]]:
    by_provider: dict[str, list[CaseResult]] = {}
    for r in results:
        by_provider.setdefault(r.provider, []).append(r)

    summary: dict[str, dict[str, Any]] = {}
    for provider, rows in by_provider.items():
        successes = [r for r in rows if r.success]
        json_ok = [r for r in rows if r.json_valid]
        latencies = [r.latency_ms for r in successes] or [0]
        costs = [r.est_cost_micro_usd or 0 for r in successes]
        summary[provider] = {
            "total": len(rows),
            "http_success_rate": round(len(successes) / max(len(rows), 1), 4),
            "json_valid_rate": round(len(json_ok) / max(len(rows), 1), 4),
            "p50_latency_ms": int(statistics.median(latencies)),
            "p95_latency_ms": int(
                statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies)
            ),
            "total_micro_usd": sum(costs),
            "avg_section_count": round(
                statistics.mean([r.section_count for r in json_ok]) if json_ok else 0, 2
            ),
        }
    return summary


def write_report(
    out_dir: pathlib.Path,
    cases_count: int,
    summary: dict[str, dict[str, Any]],
    raw: list[CaseResult],
) -> tuple[pathlib.Path, pathlib.Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    json_path = out_dir / f"matrix-{stamp}.json"
    md_path = out_dir / f"matrix-{stamp}.md"

    json_path.write_text(
        json.dumps(
            {
                "generated_at": stamp,
                "cases": cases_count,
                "summary": summary,
                "raw": [dataclasses.asdict(r) for r in raw],
            },
            indent=2,
        )
    )

    lines: list[str] = []
    lines.append(f"# Egide eval matrix — {stamp}\n")
    lines.append(f"Cases per provider: **{cases_count}**\n")
    lines.append(
        "| Provider | HTTP success | JSON valid | p50 ms | p95 ms | µUSD total | avg sections |"
    )
    lines.append("|---|---:|---:|---:|---:|---:|---:|")
    for provider, s in sorted(summary.items()):
        lines.append(
            f"| {provider} | {s['http_success_rate']:.0%} | {s['json_valid_rate']:.0%} "
            f"| {s['p50_latency_ms']} | {s['p95_latency_ms']} "
            f"| {s['total_micro_usd']} | {s['avg_section_count']} |"
        )
    lines.append("")
    lines.append("Raw results: `" + json_path.name + "`")
    md_path.write_text("\n".join(lines))
    return json_path, md_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--providers", default=",".join(DEFAULT_PROVIDERS))
    parser.add_argument(
        "--fixtures",
        default=str(REPO_ROOT / "tests" / "eval" / "fixtures" / "classification"),
    )
    parser.add_argument("--max-cases", type=int, default=50)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--out", default=str(DEFAULT_RESULTS_DIR))
    args = parser.parse_args(argv)

    api_url = os.getenv("EGIDE_API_URL", "http://localhost:3000")
    token = os.getenv("EGIDE_ORCHESTRATOR_TOKEN", "")
    tenant = os.getenv("EGIDE_TENANT_ID", "")
    if not token or not tenant:
        print(
            "error: EGIDE_ORCHESTRATOR_TOKEN and EGIDE_TENANT_ID must be set",
            file=sys.stderr,
        )
        return 2

    providers = [p.strip() for p in args.providers.split(",") if p.strip()]
    cases = load_cases(pathlib.Path(args.fixtures), args.max_cases)
    print(f"running {len(cases)} cases × {len(providers)} providers")

    results = asyncio.run(
        run_matrix(api_url, token, tenant, cases, providers, args.concurrency)
    )
    summary = summarize(results)
    json_path, md_path = write_report(pathlib.Path(args.out), len(cases), summary, results)
    print(f"wrote {md_path}")
    print(f"wrote {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
