#!/usr/bin/env python3
"""
ingest_ontologies — RAG bootstrap for the normative index.

Reads all 10 cluster YAMLs from ontologies/clusters/, flattens each
framework_anchor into an ontology_chunks row, generates text embeddings,
and upserts into Postgres (via psycopg, no ORM).

Run once at setup, re-run to refresh:
  uv run python -m services.extractor.ingest_ontologies

Or via the compose dev environment:
  docker compose exec api python -m services.extractor.ingest_ontologies

Env vars:
  POSTGRES_URL      — required, e.g. postgresql://postgres:postgres@localhost:5432/egide
  EMBEDDING_PROVIDER — "ollama" | "openai_compat" (default: "ollama")
  EMBEDDING_MODEL   — model name (default: "nomic-embed-text" for Ollama)
  OLLAMA_URL        — required if EMBEDDING_PROVIDER=ollama (default: http://localhost:11434)
  OPENAI_BASE_URL   — required if EMBEDDING_PROVIDER=openai_compat
  OPENAI_API_KEY    — required if EMBEDDING_PROVIDER=openai_compat

Security:
  - Input: YAML files from the repo (trusted, read-only source).
  - Embeddings: sent to configured provider only (never to cloud if Ollama).
  - DB writes: parameterized queries only (no string interpolation).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import pathlib
import sys
import uuid
from typing import Any

import httpx
import psycopg
import yaml

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

REPO_ROOT = pathlib.Path(__file__).resolve().parents[4]
CLUSTERS_DIR = REPO_ROOT / "ontologies" / "clusters"

POSTGRES_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "ollama")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Dimension expected by the schema (vector(1536)).
# nomic-embed-text produces 768 dims — adapt migration DDL if you use it.
# text-embedding-3-small produces 1536 dims (matches schema default).
EXPECTED_DIMS = 1536


def _framework_label(raw_id: str) -> str:
    """Normalize framework id to canonical label, e.g. 'iso27001-2022' → 'ISO27001:2022'."""
    mapping = {
        "iso27001-2022": "ISO27001:2022",
        "iso27001": "ISO27001:2022",
        "nis2": "NIS2",
        "iso9001-2026": "ISO9001:2026",
        "iso9001": "ISO9001:2026",
        "dora": "DORA",
        "hds": "HDS",
        "cis": "CIS",
    }
    return mapping.get(raw_id.lower(), raw_id.upper())


def _chunk_text(anchor: dict[str, Any], cluster_label: str) -> str:
    """Build a rich text representation for embedding."""
    parts = [
        f"Cluster: {cluster_label}",
        f"Framework: {_framework_label(anchor['framework'])}",
        f"Clause: {anchor['ref']}",
    ]
    for key in ("objective", "obligation_fr", "note"):
        if anchor.get(key):
            parts.append(str(anchor[key]))
    return "\n".join(parts)


async def _embed_ollama(texts: list[str]) -> list[list[float]]:
    """Embed via Ollama /api/embed (batch)."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/embed",
            json={"model": EMBEDDING_MODEL, "input": texts},
        )
        resp.raise_for_status()
    data = resp.json()
    embeddings: list[list[float]] = data["embeddings"]
    return embeddings


async def _embed_openai_compat(texts: list[str]) -> list[list[float]]:
    """Embed via OpenAI-compatible /v1/embeddings API."""
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{OPENAI_BASE_URL}/v1/embeddings",
            headers=headers,
            json={"model": EMBEDDING_MODEL, "input": texts},
        )
        resp.raise_for_status()
    data = resp.json()
    return [item["embedding"] for item in data["data"]]


async def embed(texts: list[str]) -> list[list[float] | None]:
    """Embed texts; returns None per item on failure (continues ingest without embedding)."""
    if not texts:
        return []
    try:
        if EMBEDDING_PROVIDER == "ollama":
            return await _embed_ollama(texts)
        elif EMBEDDING_PROVIDER == "openai_compat":
            return await _embed_openai_compat(texts)
        else:
            logger.warning("Unknown EMBEDDING_PROVIDER=%s — skipping embeddings", EMBEDDING_PROVIDER)
            return [None] * len(texts)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Embedding failed (%s) — continuing without vectors: %s", type(exc).__name__, exc)
        return [None] * len(texts)


def load_clusters() -> list[dict[str, Any]]:
    """Load and return all cluster YAML files."""
    clusters = []
    for path in sorted(CLUSTERS_DIR.glob("*.yaml")):
        with path.open() as f:
            clusters.append(yaml.safe_load(f))
        logger.info("Loaded cluster: %s", path.name)
    return clusters


def flatten_anchors(clusters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extract individual anchor rows from cluster data."""
    rows: list[dict[str, Any]] = []
    for cluster in clusters:
        cluster_id = cluster.get("id", "")
        cluster_label = cluster.get("label_en", cluster_id)
        for anchor in cluster.get("framework_anchors", []):
            rows.append(
                {
                    "id": str(uuid.uuid4()),
                    "cluster": cluster_id,
                    "framework": _framework_label(anchor.get("framework", "")),
                    "clause": anchor.get("ref", ""),
                    "title": anchor.get("objective") or anchor.get("obligation_fr") or anchor.get("ref", ""),
                    "text": _chunk_text(anchor, cluster_label),
                    "metadata": json.dumps(
                        {
                            "weight": anchor.get("weight"),
                            "category": anchor.get("category"),
                            "note": anchor.get("note"),
                        }
                    ),
                }
            )
    return rows


async def upsert_chunks(rows: list[dict[str, Any]], embeddings: list[list[float] | None]) -> int:
    """Insert/upsert ontology_chunks into Postgres. Returns inserted count."""
    if not POSTGRES_URL:
        logger.error("POSTGRES_URL is not set — cannot write to DB")
        sys.exit(1)

    count = 0
    async with await psycopg.AsyncConnection.connect(POSTGRES_URL) as conn:
        async with conn.cursor() as cur:
            # Delete existing rows for these clusters before re-inserting
            # (idempotent re-run support)
            clusters_seen = {row["cluster"] for row in rows}
            for cluster in clusters_seen:
                await cur.execute(
                    "DELETE FROM ontology_chunks WHERE cluster = %s", (cluster,)
                )

            for row, emb in zip(rows, embeddings, strict=True):
                emb_value = f"[{','.join(str(x) for x in emb)}]" if emb else None
                await cur.execute(
                    """
                    INSERT INTO ontology_chunks
                      (id, cluster, framework, clause, title, text, embedding, metadata, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::vector, %s::jsonb, NOW())
                    """,
                    (
                        row["id"],
                        row["cluster"],
                        row["framework"],
                        row["clause"],
                        row["title"],
                        row["text"],
                        emb_value,
                        row["metadata"],
                    ),
                )
                count += 1

        await conn.commit()
    return count


async def main() -> None:
    logger.info("Egide — ontology ingestor starting")
    logger.info("Clusters dir: %s", CLUSTERS_DIR)
    logger.info("Embedding provider: %s / model: %s", EMBEDDING_PROVIDER, EMBEDDING_MODEL)

    clusters = load_clusters()
    logger.info("Loaded %d clusters", len(clusters))

    rows = flatten_anchors(clusters)
    logger.info("Extracted %d anchors", len(rows))

    texts = [row["text"] for row in rows]
    embeddings = await embed(texts)
    embedded_count = sum(1 for e in embeddings if e is not None)
    logger.info("Embedded %d/%d chunks", embedded_count, len(rows))

    inserted = await upsert_chunks(rows, embeddings)
    logger.info("Upserted %d rows into ontology_chunks", inserted)
    logger.info("Done.")


if __name__ == "__main__":
    asyncio.run(main())
