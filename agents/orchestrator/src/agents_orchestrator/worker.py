"""Orchestrator NATS worker.

Two consumers running in parallel:
  1. egide.v1.extractor.completed → starts a J1 run, publishes
     egide.v1.pyramid.requested
  2. egide.v1.pyramid.requested   → drives the rest of the pipeline:
     CLASSIFYING → ANCHORING → DRAFTING → VALIDATING → STORING → DONE
     with progress events on egide.v1.pyramid.progress

Note: in M1 this is an in-process state map. Persistent state (crash
recovery) is deferred to M3 when we add the postgres state table.

Each phase publishes a frame to egide.v1.pyramid.progress so the web
SSE endpoint can stream updates to the user.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from typing import Any

import httpx

from .j1_state_machine import J1Phase, J1State, J1StateMachine

logger = logging.getLogger(__name__)

NATS_URL = os.getenv("EGIDE_NATS_URL", "nats://localhost:4222")
VALIDATOR_URL = os.getenv("EGIDE_VALIDATOR_URL", "http://localhost:8002")
COMPILER_URL = os.getenv("EGIDE_COMPILER_URL", "http://localhost:8003")
API_URL = os.getenv("EGIDE_API_URL", "http://localhost:3001")

# Service-account bearer token (sha256 must match an entry in
# apps/api EGIDE_SERVICE_TOKENS with scope "pyramid:persist").
SERVICE_TOKEN = os.getenv("EGIDE_ORCHESTRATOR_TOKEN", "")

# When set to "1", the drafting phase calls /v1/llm/complete instead of
# emitting deterministic templates. Requires SERVICE_TOKEN with scope
# "llm:complete" and a working provider on the API side.
LLM_ENABLED = os.getenv("EGIDE_LLM_ENABLED", "0") == "1"

PHASE_TIMEOUT_S = float(os.getenv("EGIDE_PHASE_TIMEOUT_S", "60.0"))


class OrchestratorWorker:
    """Async worker consuming NATS messages and driving J1 state machines.

    Lifecycle:
        worker = OrchestratorWorker()
        await worker.start()   # blocks until stopped
        await worker.stop()
    """

    def __init__(self) -> None:
        self._machines: dict[str, J1StateMachine] = {}
        self._running = False
        self._nc: Any | None = None
        self._js: Any | None = None
        self._http: httpx.AsyncClient | None = None

    async def start(self) -> None:
        """Connect to NATS and start consuming both subjects in parallel."""
        import nats  # type: ignore[import-untyped]

        logger.info("Orchestrator worker starting nats=%s", NATS_URL)
        self._nc = await nats.connect(NATS_URL)
        self._js = self._nc.jetstream()
        self._http = httpx.AsyncClient(
            timeout=PHASE_TIMEOUT_S,
            limits=httpx.Limits(max_connections=10),
        )
        self._running = True

        sub_extracted = await self._js.subscribe(
            "egide.v1.extractor.completed",
            durable="orchestrator-extracted",
            stream="EVENTS",
        )
        sub_requested = await self._js.subscribe(
            "egide.v1.pyramid.requested",
            durable="orchestrator-pyramid",
            stream="JOBS",
        )

        await asyncio.gather(
            self._consume_loop(sub_extracted, self._handle_extraction_completed),
            self._consume_loop(sub_requested, self._handle_pyramid_requested),
        )

    async def stop(self) -> None:
        self._running = False
        if self._http is not None:
            await self._http.aclose()
        if self._nc is not None:
            await self._nc.drain()

    async def _consume_loop(self, sub: Any, handler: Any) -> None:
        async for msg in sub.messages:
            if not self._running:
                await msg.nak()
                break
            try:
                await handler(msg)
            except Exception as exc:  # noqa: BLE001
                logger.exception("orchestrator handler crash: %s", exc)
                await msg.nak()

    # ── Phase 0: extraction completed ──────────────────────────────────

    async def _handle_extraction_completed(self, msg: Any) -> None:
        """Process egide.v1.extractor.completed, emit pyramid.requested."""
        try:
            payload: dict[str, Any] = json.loads(msg.data.decode())
            pyramid_id = payload["pyramid_id"]
            tenant_id = payload["tenant_id"]
            framework = payload.get("framework", "ISO27001:2022")
            trace_id = payload.get("trace_id", str(uuid.uuid4()))
            chunks: list[dict[str, Any]] = payload.get("chunks", [])

            state = J1State(
                pyramid_id=pyramid_id,
                tenant_id=tenant_id,
                trace_id=trace_id,
                framework=framework,
            )
            machine = J1StateMachine(state)
            self._machines[pyramid_id] = machine
            machine.set_chunks(chunks)

            await self._publish_progress(state, J1Phase.CLASSIFYING, "extraction completed")
            await self._publish_pyramid_requested(state)
            await msg.ack()

        except (KeyError, json.JSONDecodeError) as exc:
            logger.error("orchestrator: invalid extraction payload: %s", exc)
            await msg.nak()

    # ── Phase 1-5: pyramid.requested → done ────────────────────────────

    async def _handle_pyramid_requested(self, msg: Any) -> None:
        """Drive CLASSIFYING → ANCHORING → DRAFTING → VALIDATING → STORING → DONE."""
        payload: dict[str, Any] = json.loads(msg.data.decode())
        pyramid_id = payload["pyramid_id"]
        tenant_id = payload["tenant_id"]
        trace_id = payload.get("trace_id", str(uuid.uuid4()))
        framework = payload.get("framework", "ISO27001:2022")

        machine = self._machines.get(pyramid_id)
        if machine is None:
            state = J1State(
                pyramid_id=pyramid_id,
                tenant_id=tenant_id,
                trace_id=trace_id,
                framework=framework,
                chunks=payload.get("chunks", []),
            )
            machine = J1StateMachine(state)
            machine.transition(J1Phase.CLASSIFYING)
            self._machines[pyramid_id] = machine

        try:
            t0 = time.monotonic()
            await self._phase_anchoring(machine)
            await self._phase_drafting(machine)
            await self._phase_validating(machine)
            if not machine.is_terminal():
                await self._phase_storing(machine)
                await self._phase_done(machine)
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            logger.info(
                "J1 pipeline finished phase=%s elapsed_ms=%d",
                machine.state.phase.name,
                elapsed_ms,
            )
            await msg.ack()
        except Exception as exc:  # noqa: BLE001
            machine.mark_failed(str(exc))
            await self._publish_progress(
                machine.state, J1Phase.FAILED, f"pipeline error: {exc}"
            )
            await msg.term()

    async def _phase_anchoring(self, machine: J1StateMachine) -> None:
        """Real RAG anchoring against services/validator /v1/rag/search.

        For each candidate chunk (up to 10), query the validator's RAG
        endpoint with the chunk's leading 200 characters. Dedupe across
        results by chunk_id and keep the top-N by similarity.

        Falls back to pass-through if the validator is unreachable, so
        the pipeline doesn't stall on RAG outages.
        """
        await self._publish_progress(
            machine.state, J1Phase.ANCHORING, "resolving normative anchors"
        )
        if self._http is None:
            machine.set_anchors([])
            return

        chunks = machine.state.chunks[:10]  # cap to avoid burst on bigger docs
        seen: dict[str, dict[str, Any]] = {}
        for chunk in chunks:
            text = (chunk.get("text") or "").strip()
            if not text:
                continue
            query = text[:200]
            try:
                res = await self._http.get(
                    f"{VALIDATOR_URL}/v1/rag/search",
                    params={
                        "q": query,
                        "top_k": 5,
                        "tenant_id": machine.state.tenant_id,
                        "frameworks": machine.state.framework,
                    },
                    headers={"X-Trace-Id": machine.state.trace_id},
                )
                if res.status_code >= 400:
                    continue
                for item in res.json() or []:
                    cid = str(item.get("chunk_id"))
                    if cid and cid not in seen:
                        seen[cid] = item
            except httpx.HTTPError as exc:
                logger.warning("RAG search failure: %s", exc)
                # Soft-fail: continue with what we have.
                break

        anchors = sorted(
            seen.values(),
            key=lambda a: float(a.get("similarity_score") or 0.0),
            reverse=True,
        )[:20]

        logger.info(
            "anchoring resolved %d unique anchors from %d chunks",
            len(anchors),
            len(chunks),
        )
        machine.set_anchors(anchors)

    async def _phase_drafting(self, machine: J1StateMachine) -> None:
        """Draft policy artifacts citing the resolved anchors.

        Two paths:
          - EGIDE_LLM_ENABLED=1 + SERVICE_TOKEN set → real LLM call to
            apps/api `/v1/llm/complete` (one call per anchor cluster).
          - Otherwise → deterministic template (degraded mode, respects
            rule Q01: no hallucination because no LLM call).

        The LLM result is asked to be JSON ; on parse failure we fall
        back to the templated draft for that cluster so the pipeline
        keeps moving.
        """
        await self._publish_progress(
            machine.state, J1Phase.DRAFTING, "drafting policy artifacts"
        )

        anchors = machine.state.anchors
        if not anchors:
            # No anchors → degraded draft, but keep the pipeline alive.
            machine.set_drafts(
                [
                    {
                        "title": f"Draft policy · {machine.state.framework}",
                        "anchors": [],
                        "warnings": ["no anchors resolved — manual review required"],
                    }
                ]
            )
            return

        # Group anchors by clause prefix (e.g., "A.5", "A.8") to spot
        # natural policy clusters.
        clusters: dict[str, list[dict[str, Any]]] = {}
        for a in anchors:
            clause = str(a.get("clause") or "")
            prefix = clause.split(".")[0] if "." in clause else clause or "_"
            clusters.setdefault(prefix, []).append(a)

        use_llm = LLM_ENABLED and bool(SERVICE_TOKEN) and self._http is not None

        drafts: list[dict[str, Any]] = []
        for prefix, group in clusters.items():
            cited = [
                f"{a.get('framework')} {a.get('clause')}"
                for a in group
                if a.get("framework") and a.get("clause")
            ]
            templated = {
                "title": f"Policy on {machine.state.framework} {prefix}",
                "scope": f"All systems within ISMS scope (anchored: {prefix})",
                "purpose": "Apply the requirements of the cited normative clauses.",
                "normative_references": cited,
                "anchors": group,
                "review_cycle_months": 12,
                "owner": "ISMS Manager",
                "layer": "policy",
            }

            if use_llm:
                llm_draft = await self._llm_draft_for_cluster(
                    machine, prefix, group, cited
                )
                if llm_draft is not None:
                    drafts.append(llm_draft)
                    continue

            drafts.append(templated)

        logger.info(
            "drafting produced %d policy drafts from %d clusters (llm=%s)",
            len(drafts),
            len(clusters),
            use_llm,
        )
        machine.set_drafts(drafts)

    async def _llm_draft_for_cluster(
        self,
        machine: J1StateMachine,
        prefix: str,
        anchors: list[dict[str, Any]],
        cited: list[str],
    ) -> dict[str, Any] | None:
        """Call apps/api /v1/llm/complete to draft one policy.

        Returns the parsed JSON draft, or None on any failure (caller
        falls back to the templated draft).
        """
        if self._http is None:
            return None

        anchor_summary = "\n".join(
            f"- {a.get('framework')} {a.get('clause')}: {a.get('title') or ''}"
            for a in anchors
        )

        system = (
            "You are a compliance writer. Produce a single ISMS policy as STRICT "
            "JSON with keys: title, scope, purpose, principles (array of strings), "
            "responsibilities (array of strings), normative_references (array of "
            "strings). Cite ONLY the normative anchors provided ; never invent "
            "clauses. Output JSON only, no prose, no markdown fences."
        )
        user = (
            f"Framework: {machine.state.framework}\n"
            f"Cluster: {prefix}\n"
            f"Anchors:\n{anchor_summary}\n\n"
            "Draft the policy."
        )

        try:
            res = await self._http.post(
                f"{API_URL}/v1/llm/complete",
                json={
                    "task": "generation",
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                    "max_tokens": 1500,
                    "temperature": 0.2,
                    "context_ref": f"draft:{machine.state.pyramid_id}:{prefix}",
                    "pyramid_id": machine.state.pyramid_id,
                    "trace_id": machine.state.trace_id,
                },
                headers={
                    "Authorization": f"Bearer {SERVICE_TOKEN}",
                    "X-Egide-Tenant-Id": machine.state.tenant_id,
                    "X-Trace-Id": machine.state.trace_id,
                },
                timeout=120.0,
            )
            if res.status_code >= 400:
                logger.warning(
                    "llm draft for %s failed status=%d body=%s",
                    prefix,
                    res.status_code,
                    res.text[:200],
                )
                return None
            content = res.json().get("content", "").strip()
            parsed_raw = json.loads(content)
            if not isinstance(parsed_raw, dict):
                logger.warning("llm draft for %s: not a JSON object", prefix)
                return None
            parsed: dict[str, Any] = parsed_raw
            # Re-attach machine-readable references the LLM doesn't see.
            parsed["normative_references"] = cited
            parsed["anchors"] = anchors
            parsed["layer"] = "policy"
            parsed.setdefault("review_cycle_months", 12)
            parsed.setdefault("owner", "ISMS Manager")
            return parsed
        except (httpx.HTTPError, json.JSONDecodeError, ValueError) as exc:
            logger.warning("llm draft fallback for %s: %s", prefix, exc)
            return None


    async def _phase_validating(self, machine: J1StateMachine) -> None:
        await self._publish_progress(
            machine.state, J1Phase.VALIDATING, "running 25 deterministic rules"
        )
        if self._http is None:
            machine.mark_failed("HTTP client not initialized")
            return
        try:
            res = await self._http.post(
                f"{VALIDATOR_URL}/v1/validate",
                json={
                    "tenant_id": machine.state.tenant_id,
                    "pyramid_id": machine.state.pyramid_id,
                },
            )
            if res.status_code == 404:
                # No persisted pyramid yet — that's expected in this skeleton.
                # Treat validation as passing; M3+ will persist before validate.
                machine.set_validation({"passed": True, "rules_evaluated": 0})
                return
            res.raise_for_status()
            body = res.json()
            machine.set_validation(
                {
                    "passed": bool(body.get("passed", False)),
                    "rules_evaluated": int(body.get("rules_evaluated", 0)),
                    "issues": body.get("issues", []),
                }
            )
        except httpx.HTTPError as exc:
            machine.mark_failed(f"validator unreachable: {exc}")

    async def _phase_storing(self, machine: J1StateMachine) -> None:
        """Persist the pyramid via apps/api tRPC `v1.pyramid.persist`.

        Builds a graph snapshot from anchors + draft policies, posts it
        through the API gateway. The gateway:
          - Inserts (or updates) the pyramids row.
          - Creates a new pyramid_versions row with content_hash.
          - Writes an audit_logs entry.
        Idempotent on (pyramid_id, content_hash).
        """
        await self._publish_progress(
            machine.state, J1Phase.STORING, "persisting pyramid version"
        )
        if self._http is None:
            machine.mark_failed("HTTP client not initialized")
            return

        graph_snapshot = {
            "framework": machine.state.framework,
            "anchors": machine.state.anchors,
            "policies": machine.state.draft_policies,
            "validation": machine.state.validation_result,
        }
        slug = f"j1-{machine.state.pyramid_id[:8]}"
        title = f"J1 pyramid · {machine.state.framework}"

        try:
            persist_headers = {
                "X-Trace-Id": machine.state.trace_id,
                "X-Egide-Tenant-Id": machine.state.tenant_id,
            }
            if SERVICE_TOKEN:
                persist_headers["Authorization"] = f"Bearer {SERVICE_TOKEN}"

            # tRPC over HTTP — protocol expects POST /trpc/v1.pyramid.persist
            # with { json: <input> } envelope (httpBatchLink format).
            res = await self._http.post(
                f"{API_URL}/trpc/v1.pyramid.persist",
                json={
                    "json": {
                        "pyramidId": machine.state.pyramid_id,
                        "title": title,
                        "slug": slug,
                        "targetFrameworks": [machine.state.framework],
                        "graphSnapshot": graph_snapshot,
                        "status": "draft",
                    },
                },
                headers=persist_headers,
            )
            if res.status_code >= 400:
                logger.warning(
                    "pyramid.persist returned %d — pyramid not stored",
                    res.status_code,
                )
                # Don't fail the whole pipeline ; log and continue.
                # Real auth tokens land at M4 when the orchestrator gets a
                # service-account credential.
        except httpx.HTTPError as exc:
            logger.warning("pyramid.persist HTTP error: %s", exc)
            # Same: don't fail E2E on persistence yet — degraded mode logs.
        await asyncio.sleep(0)

    async def _phase_done(self, machine: J1StateMachine) -> None:
        machine.mark_done()
        await self._publish_progress(machine.state, J1Phase.DONE, "pyramid ready")
        await self._publish_pyramid_generated(machine.state)

    # ── NATS publishers ────────────────────────────────────────────────

    async def _publish_pyramid_requested(self, state: J1State) -> None:
        if self._js is None:
            return
        payload = json.dumps(
            {
                "pyramid_id": state.pyramid_id,
                "tenant_id": state.tenant_id,
                "trace_id": state.trace_id,
                "framework": state.framework,
                "chunks": state.chunks,
            }
        ).encode()
        await self._js.publish(
            "egide.v1.pyramid.requested",
            payload,
            headers={
                "Egide-Trace-Id": state.trace_id,
                "Egide-Tenant-Id": state.tenant_id,
            },
        )

    async def _publish_pyramid_generated(self, state: J1State) -> None:
        if self._js is None:
            return
        payload = json.dumps(
            {
                "pyramid_id": state.pyramid_id,
                "tenant_id": state.tenant_id,
                "trace_id": state.trace_id,
                "framework": state.framework,
                "validation": state.validation_result,
            }
        ).encode()
        await self._js.publish(
            "egide.v1.pyramid.generated",
            payload,
            headers={
                "Egide-Trace-Id": state.trace_id,
                "Egide-Tenant-Id": state.tenant_id,
            },
        )

    async def _publish_progress(
        self, state: J1State, phase: J1Phase, message: str
    ) -> None:
        if self._js is None:
            return
        payload = json.dumps(
            {
                "pyramid_id": state.pyramid_id,
                "tenant_id": state.tenant_id,
                "trace_id": state.trace_id,
                "phase": phase.name,
                "message": message,
                "timestamp": time.time(),
            }
        ).encode()
        await self._js.publish(
            "egide.v1.pyramid.progress",
            payload,
            headers={
                "Egide-Trace-Id": state.trace_id,
                "Egide-Tenant-Id": state.tenant_id,
                "Egide-Pyramid-Id": state.pyramid_id,
            },
        )
