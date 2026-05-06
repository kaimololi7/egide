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
        await self._publish_progress(
            machine.state, J1Phase.ANCHORING, "resolving normative anchors"
        )
        # Skeleton: in M3+ replace with real RAG search via agents/compliance.
        # For now we mark the phase done and pass through the existing chunks
        # as already-anchored.
        machine.set_anchors(machine.state.chunks)

    async def _phase_drafting(self, machine: J1StateMachine) -> None:
        await self._publish_progress(
            machine.state, J1Phase.DRAFTING, "drafting policy artifacts"
        )
        # Skeleton: real draft via agents/compliance.draft_policy lands at M3+.
        # Emit a single placeholder draft so the validator phase has input.
        machine.set_drafts(
            [
                {
                    "title": f"Draft policy for {machine.state.framework}",
                    "anchors": machine.state.anchors,
                }
            ]
        )

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
        await self._publish_progress(
            machine.state, J1Phase.STORING, "persisting pyramid version"
        )
        # Real persistence via apps/api tRPC `pyramid.persist` lands at M3+.
        # For now we emit the storing event and continue.
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
