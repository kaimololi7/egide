"""Module entry point: ``python -m agents_orchestrator``.

Boots the NATS-driven OrchestratorWorker for the J1 pipeline.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal

from .worker import OrchestratorWorker


async def _main() -> None:
    logging.basicConfig(
        level=os.getenv("EGIDE_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    worker = OrchestratorWorker()
    stop_event = asyncio.Event()

    def _request_stop(*_: object) -> None:
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _request_stop)

    await worker.start()
    await stop_event.wait()


if __name__ == "__main__":
    asyncio.run(_main())
