"""
Egide document extractor — FastAPI application.

Endpoints:
  GET  /health         — liveness probe
  POST /v1/extract     — extract text from an uploaded document

Security:
  - tenant_id validated as UUID (cf. ADR 014 §A01)
  - MIME type allow-listed (cf. ADR 014 §A04)
  - File size capped at 50 MB
  - No server-side path construction from user input

Auth: expected to run behind the API gateway (apps/api) which handles
Better-Auth. The X-Tenant-Id and X-Trace-Id headers are injected by
the gateway after session validation.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from .dispatch import ExtractionError, dispatch
from .models import ExtractResponse, HealthResponse

logger = logging.getLogger(__name__)

app = FastAPI(
    title="egide-extractor",
    version="0.0.1",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)


@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health() -> HealthResponse:
    return HealthResponse()


@app.post(
    "/v1/extract",
    response_model=ExtractResponse,
    status_code=status.HTTP_200_OK,
    tags=["extraction"],
    summary="Extract structured text from a document",
)
async def extract(
    file: UploadFile = File(..., description="Document to extract (PDF, DOCX, HTML, TXT, ...)"),
    tenant_id: str = Form(..., description="Tenant UUID (injected by gateway)"),
    # Gateway injects trace ID; optional for internal calls
    x_trace_id: str | None = Header(default=None, alias="X-Trace-Id"),
) -> ExtractResponse:
    # Validate tenant_id format (ADR 014 §A01)
    try:
        uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tenant_id must be a valid UUID",
        )

    filename = file.filename or "unknown"
    mime_type = file.content_type or "application/octet-stream"

    # Read file content
    try:
        data = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded file", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file",
        )

    try:
        result = dispatch(
            data=data,
            filename=filename,
            mime_type=mime_type,
            tenant_id=tenant_id,
            trace_id=x_trace_id,
        )
    except ExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unexpected extraction error",
            exc_info=exc,
            extra={"tenant_id": tenant_id, "filename": filename},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Extraction failed",
        )

    return result


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: object, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )
