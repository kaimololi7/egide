"""
python-docx extractor — for .docx files.
"""

from __future__ import annotations

import io

from ..models import ChunkMetadata, DocumentChunk, ExtractorName


def extract_with_docx(
    data: bytes,
) -> tuple[list[DocumentChunk], str | None, int | None]:
    """
    Extract text chunks from a .docx file using python-docx.

    Returns:
        (chunks, title, page_count)  — page_count is None (docx has no reliable page count).
    """
    try:
        import docx  # type: ignore[import-untyped]
    except ImportError as e:
        raise RuntimeError(f"python-docx not installed: {e}") from e

    document = docx.Document(io.BytesIO(data))

    title: str | None = None
    chunks: list[DocumentChunk] = []
    current_heading: str | None = None

    for para in document.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        style_name = para.style.name if para.style else ""

        if style_name.startswith("Heading 1"):
            if title is None:
                title = text
            current_heading = text
        elif style_name.startswith("Heading"):
            current_heading = text

        chunks.append(
            DocumentChunk(
                text=text,
                metadata=ChunkMetadata(
                    heading=current_heading if style_name.startswith("Heading") else None,
                    section=current_heading,
                ),
            )
        )

    return chunks, title, None


EXTRACTOR_NAME: ExtractorName = "python-docx"
