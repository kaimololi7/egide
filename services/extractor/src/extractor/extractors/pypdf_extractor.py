"""
pypdf extractor — PDF fallback when Docling fails or is unavailable.
"""

from __future__ import annotations

import io

from ..models import ChunkMetadata, DocumentChunk, ExtractorName


def extract_with_pypdf(
    data: bytes,
) -> tuple[list[DocumentChunk], str | None, int | None]:
    """
    Extract text chunks from a PDF using pypdf.

    Returns:
        (chunks, title, page_count)
    """
    try:
        import pypdf  # type: ignore[import-untyped]
    except ImportError as e:
        raise RuntimeError(f"pypdf not installed: {e}") from e

    reader = pypdf.PdfReader(io.BytesIO(data))
    page_count = len(reader.pages)

    title: str | None = None
    meta = reader.metadata
    if meta and hasattr(meta, "title"):
        title = meta.title or None

    chunks: list[DocumentChunk] = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.strip()
        if not text:
            continue
        chunks.append(
            DocumentChunk(
                text=text,
                metadata=ChunkMetadata(page=i),
            )
        )

    return chunks, title, page_count


EXTRACTOR_NAME: ExtractorName = "pypdf"
