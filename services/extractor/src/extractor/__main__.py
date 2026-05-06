"""Entry point for `python -m extractor`."""

import uvicorn

if __name__ == "__main__":
    import os

    uvicorn.run(
        "extractor.app:app",
        host=os.getenv("HOST", "0.0.0.0"),  # noqa: S104 — container-internal, gateway enforces mTLS
        port=int(os.getenv("PORT", "8001")),
        log_level=os.getenv("LOG_LEVEL", "info"),
        workers=int(os.getenv("WORKERS", "1")),
    )
