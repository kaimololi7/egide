"""
Pydantic models for the extractor service.

All request/response types are versioned under the /v1 prefix (cf. ADR 015).
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class ChunkMetadata(BaseModel):
    """Positional and structural metadata attached to every text chunk."""

    page: int | None = None
    heading: str | None = None
    section: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class DocumentChunk(BaseModel):
    """Single text unit extracted from a document."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    metadata: ChunkMetadata = Field(default_factory=ChunkMetadata)


ExtractorName = Literal["docling", "pypdf", "python-docx", "markitdown", "plain-text"]


class ExtractResponse(BaseModel):
    """Structured output of POST /v1/extract."""

    doc_id: str
    tenant_id: str
    filename: str
    mime_type: str
    size_bytes: int
    pages: int | None = None
    chunks: list[DocumentChunk]
    title: str | None = None
    extractor_used: ExtractorName
    extraction_time_ms: int
    warning: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "egide-extractor"
    version: str = "0.0.1"
