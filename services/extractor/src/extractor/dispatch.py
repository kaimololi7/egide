"""
Extraction dispatcher — picks the right extractor based on MIME type,
with Docling as primary and format-specific fallbacks.

Cascade (cf. CLAUDE.md):
  PDF    → Docling → pypdf
  DOCX   → Docling → python-docx
  PPTX   → Docling → markitdown
  HTML   → Docling → markitdown
  MD/TXT → plain text (no extractor needed)
  Others → markitdown
"""

from __future__ import annotations

import time
import uuid
import logging

from .models import DocumentChunk, ExtractResponse, ExtractorName
from .extractors import (
    DoclingExtractorError,
    extract_with_docling,
    extract_with_docx,
    extract_with_markitdown,
    extract_with_pypdf,
)

logger = logging.getLogger(__name__)

# Max file size: 50 MB (cf. ADR 014 \u00a7A04 — input validation at trust boundary)
MAX_FILE_BYTES = 50 * 1024 * 1024

# Allowed MIME types
ALLOWED_MIMES: frozenset[str] = frozenset({
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "text/html",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/webp",
})


class ExtractionError(Exception):
    pass


def dispatch(
    data: bytes,
    filename: str,
    mime_type: str,
    tenant_id: str,
    trace_id: str | None = None,
) -> ExtractResponse:
    """
    Route extraction to the correct engine and return a structured response.

    Raises:
        ExtractionError: when all engines fail or input is invalid.
    """
    doc_id = str(uuid.uuid4())
    size_bytes = len(data)

    # \u2014 Input validation (cf. ADR 014 \u00a7A04) \u2014
    if size_bytes > MAX_FILE_BYTES:
        raise ExtractionError(
            f"File too large: {size_bytes} bytes (max {MAX_FILE_BYTES})"
        )
    if mime_type not in ALLOWED_MIMES:
        raise ExtractionError(f"Unsupported MIME type: {mime_type!r}")
    if size_bytes == 0:
        raise ExtractionError("Empty file")

    t0 = time.monotonic()
    chunks: list[DocumentChunk] = []
    title: str | None = None
    page_count: int | None = None
    extractor_used: ExtractorName
    warning: str | None = None

    if mime_type in ("text/plain", "text/markdown", "text/x-markdown"):
        # Plain text — no extractor needed
        text = data.decode("utf-8", errors="replace")
        chunks = _split_plain_text(text)
        extractor_used = "plain-text"

    elif mime_type == "application/pdf":
        # Primary: Docling; fallback: pypdf
        try:
            chunks, title, page_count = extract_with_docling(data, filename)
            extractor_used = "docling"
        except DoclingExtractorError as exc:
            logger.warning(
                "Docling failed for PDF, falling back to pypdf",
                extra={"trace_id": trace_id, "error": str(exc)},
            )
            warning = f"Docling failed ({exc}); used pypdf fallback."
            chunks, title, page_count = extract_with_pypdf(data)
            extractor_used = "pypdf"

    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        # Primary: Docling; fallback: python-docx
        try:
            chunks, title, page_count = extract_with_docling(data, filename)
            extractor_used = "docling"
        except DoclingExtractorError as exc:
            logger.warning(
                "Docling failed for DOCX, falling back to python-docx",
                extra={"trace_id": trace_id, "error": str(exc)},
            )
            warning = f"Docling failed ({exc}); used python-docx fallback."
            chunks, title, page_count = extract_with_docx(data)
            extractor_used = "python-docx"

    else:
        # All other types: try Docling first, fallback to MarkItDown
        try:
            chunks, title, page_count = extract_with_docling(data, filename)
            extractor_used = "docling"
        except DoclingExtractorError as exc:
            logger.warning(
                "Docling failed, falling back to markitdown",
                extra={"trace_id": trace_id, "error": str(exc)},
            )
            warning = f"Docling failed ({exc}); used markitdown fallback."
            chunks, title, page_count = extract_with_markitdown(data, filename)
            extractor_used = "markitdown"

    extraction_time_ms = int((time.monotonic() - t0) * 1000)

    return ExtractResponse(
        doc_id=doc_id,
        tenant_id=tenant_id,
        filename=filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        pages=page_count,
        chunks=chunks,
        title=title,
        extractor_used=extractor_used,
        extraction_time_ms=extraction_time_ms,
        warning=warning,
    )


def _split_plain_text(text: str) -> list[DocumentChunk]:
    """Split plain text into chunks by double newline."""
    paragraphs = text.split("\n\n")
    return [
        DocumentChunk(text=p.strip())
        for p in paragraphs
        if p.strip()
    ]
