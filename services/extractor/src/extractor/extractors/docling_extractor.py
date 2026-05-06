"""
Docling extractor — primary extraction engine.

Handles PDF, DOCX, PPTX, HTML, and image inputs.
Falls back gracefully when Docling fails; caller catches ExtractorError.

Cf. CLAUDE.md: Docling primary, no Unstructured (too heavy for air-gapped).
"""

from __future__ import annotations

import io
from typing import TYPE_CHECKING

from ..models import ChunkMetadata, DocumentChunk, ExtractorName

if TYPE_CHECKING:
    pass


class DoclingExtractorError(Exception):
    pass


def extract_with_docling(
    data: bytes,
    filename: str,
) -> tuple[list[DocumentChunk], str | None, int | None]:
    """
    Extract text chunks using Docling.

    Returns:
        (chunks, title, page_count)

    Raises:
        DoclingExtractorError: on any Docling failure (caller falls back).
    """
    try:
        from docling.document_converter import DocumentConverter  # type: ignore[import-untyped]
    except ImportError as e:
        raise DoclingExtractorError(f"Docling not installed: {e}") from e

    try:
        converter = DocumentConverter()
        # Docling accepts file-like objects.
        result = converter.convert(io.BytesIO(data), source=filename)
        doc = result.document
    except Exception as e:
        raise DoclingExtractorError(f"Docling conversion failed: {e}") from e

    chunks: list[DocumentChunk] = []
    title: str | None = None
    page_count: int | None = None

    # Extract title from metadata if available
    if hasattr(doc, "name"):
        title = doc.name or None

    # Iterate over document elements (paragraphs, headings, tables, etc.)
    try:
        for element in doc.iterate_items():
            label = getattr(element, "label", None)
            text = getattr(element, "text", "") or ""
            text = text.strip()
            if not text:
                continue

            # Determine page from provenance info
            page: int | None = None
            prov = getattr(element, "prov", None)
            if prov and hasattr(prov, "page_no"):
                page = prov.page_no
            elif prov and isinstance(prov, list) and len(prov) > 0:
                page = getattr(prov[0], "page_no", None)

            heading: str | None = None
            if label and "heading" in str(label).lower():
                heading = text

            chunks.append(
                DocumentChunk(
                    text=text,
                    metadata=ChunkMetadata(page=page, heading=heading),
                )
            )
    except Exception as e:
        raise DoclingExtractorError(f"Failed to iterate Docling document: {e}") from e

    # Try to get page count from Docling's page map
    try:
        pages = getattr(doc, "pages", None)
        if pages:
            page_count = len(pages)
    except Exception:
        pass

    return chunks, title, page_count


EXTRACTOR_NAME: ExtractorName = "docling"
