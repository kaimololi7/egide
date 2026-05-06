"""
MarkItDown extractor — for Office files, HTML, images, audio (via Microsoft MarkItDown).
Used as a universal fallback for formats Docling doesn't handle well.
"""

from __future__ import annotations

import io
import tempfile
import os

from ..models import ChunkMetadata, DocumentChunk, ExtractorName


def extract_with_markitdown(
    data: bytes,
    filename: str,
) -> tuple[list[DocumentChunk], str | None, int | None]:
    """
    Extract text via MarkItDown (converts to Markdown, then chunk by paragraph).

    Returns:
        (chunks, title, page_count)
    """
    try:
        from markitdown import MarkItDown  # type: ignore[import-untyped]
    except ImportError as e:
        raise RuntimeError(f"markitdown not installed: {e}") from e

    md = MarkItDown()

    # MarkItDown works from file paths or streams; use a temp file.
    suffix = os.path.splitext(filename)[1] or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        result = md.convert(tmp_path)
        markdown_text = result.text_content or ""
    finally:
        os.unlink(tmp_path)

    # Split Markdown into meaningful chunks by double-newline.
    raw_chunks = markdown_text.split("\n\n")
    chunks: list[DocumentChunk] = []
    title: str | None = None
    current_heading: str | None = None

    for raw in raw_chunks:
        text = raw.strip()
        if not text:
            continue
        # Detect ATX headings (#, ##, etc.)
        if text.startswith("#"):
            lines = text.splitlines()
            heading_line = lines[0].lstrip("#").strip()
            if title is None:
                title = heading_line
            current_heading = heading_line
            # Include remaining lines as body
            body = "\n".join(lines[1:]).strip()
            if body:
                chunks.append(
                    DocumentChunk(
                        text=body,
                        metadata=ChunkMetadata(heading=current_heading),
                    )
                )
        else:
            chunks.append(
                DocumentChunk(
                    text=text,
                    metadata=ChunkMetadata(heading=current_heading),
                )
            )

    return chunks, title, None


EXTRACTOR_NAME: ExtractorName = "markitdown"
