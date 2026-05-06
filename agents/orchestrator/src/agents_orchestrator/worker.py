"""
Orchestrator NATS consumer.

Listens on egide.v1.extractor.completed and drives J1State machines.
Each message starts (or resumes) one J1StateMachine instance.

Note: in M1 this is an in-process state map. Persistent state (crash
recovery) is deferred to M3 when we add the postgres state table.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any

from .j1_state_machine import J1Phase, J1State, J1StateMachine

logger = logging.getLogger(__name__)

NATS_URL = os.getenv("EGIDE_NATS_URL", "nats://localhost:4222")
VALIDATOR_URL = os.getenv("EGIDE_VALIDATOR_URL", "http://localhost:8002")


class OrchestratorWorker:
    """
    Async worker consuming NATS messages and stepping J1 state machines.

    Lifecycle:
        worker = OrchestratorWorker()
        await worker.start()   # blocks until stopped
        await worker.stop()
    """

    def __init__(self) -> None:
        self._machines: dict[str, J1StateMachine] = {}
        self._running = False

    async def start(self) -> None:
        """Connect to NATS and start consuming messages."""
        # Import here to avoid top-level import failure when nats-py not installed
        import nats  # type: ignore[import-untyped]

        logger.info("Orchestrator worker starting, nats=%s", NATS_URL)
        self._nc = await nats.connect(NATS_URL)
        self._js = self._nc.jetstream()
        self._running = True

        sub = await self._js.subscribe(
            "egide.v1.extractor.completed",
            durable="orchestrator-j1",
            stream="EVENTS",
        )

        async for msg in sub.messages:
            if not self._running:
                await msg.nak()
                break
            await self._handle_extraction_completed(msg)

    async def stop(self) -> None:
        self._running = False
        if hasattr(self, "_nc"):
            await self._nc.drain()

    async def _handle_extraction_completed(self, msg: Any) -> None:
        """
        Process egide.v1.extractor.completed message.

        Expected payload:
          {
            "pyramid_id": "<uuid>",
            "tenant_id": "<uuid>",
            "trace_id": "<uuid>",
            "framework": "ISO27001:2022",
            "chunks": [ { "chunk_id": ..., "text": ... }, ... ]
          }
        """
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

            # Transition: INGESTED → CLASSIFYING
            machine.set_chunks(chunks)

            logger.info(
                "Orchestrator: J1 started phase=%s chunks=%d",
                machine.state.phase.name,
                len(chunks),
                extra={"pyramid_id": pyramid_id, "tenant_id": tenant_id},
            )

            # Publish egide.v1.pyramid.requested for compliance super-agent
            await self._publish_pyramid_requested(state)

            await msg.ack()

        except (KeyError, json.JSONDecodeError) as exc:
            logger.error("Orchestrator: invalid message: %s", exc)
            await msg.nak()

    async def _publish_pyramid_requested(self, state: J1State) -> None:
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
