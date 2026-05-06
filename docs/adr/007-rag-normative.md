# ADR 007 — RAG normative: pgvector + cluster-based chunking

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder

## Context

Several agent journeys require retrieving the right normative anchor from
ontologies/clusters/*.yaml at runtime:

- **J1 — drop docs**: classify each extracted text chunk against ISO 27001
  + NIS2 + DORA controls.
- **Pyramid generation**: when an agent drafts a policy, find the relevant
  anchors to cite (`iso27001-2022:A.8.32`, `nis2:Art.21.2.f`, etc.).
- **Hallucination guard** (rule Q01 in `pyramid-coherence-rules.md`):
  reject any anchor cited by an agent that does not exist in the ontology.

A naive approach sends 93 ISO 27001 controls + 14 NIS2 articles + 5 DORA
chapters in every prompt. That's 50K+ tokens of context wasted **per
chunk classified**, multiplied by hundreds of chunks per J1 execution.
Cost-prohibitive on cloud LLMs and impossible on Ollama 7B (context
exhaustion). A RAG layer is mandatory.

## Decision

### Vector store: pgvector

**pgvector** as a PostgreSQL extension is the primary vector store.

| Option | Why rejected |
|---|---|
| Qdrant | Excellent but separate service; air-gapped deployment burden |
| Weaviate | Heavier, opinionated, non-trivial ops |
| Chroma | Not multi-tenant ready, dev-grade |
| Milvus | Overkill, complex ops |
| Elasticsearch dense_vector | Java + license ambiguity |
| **pgvector** | Already PG; zero new infra; HNSW + IVFFlat; multi-tenant via tenant_id column |

Capacity ceiling: ~5M chunks per tenant before pgvector slows
noticeably. At 10 KB average per cluster YAML × 10 clusters × N
frameworks × 100 chunks per framework = ~10K chunks total. Headroom is
huge.

Migration path: when a Pro+ customer needs >5M chunks (e.g., MSSP
console J7 indexing many tenants), Qdrant can be added behind the same
`RAGClient` interface in `apps/api`.

### Embedding models

Per-task choice via the LLM Router:

| Mode | Model | Why |
|---|---|---|
| **Sovereign cloud (Pro+)** | Mistral `mistral-embed` | EU-hosted, 1024-dim, FR-quality |
| **Local (Community / air-gapped)** | Ollama `nomic-embed-text` (768-dim) | Free, air-gapped capable, decent quality |
| **Anthropic BYOK (Pro+)** | Voyage `voyage-3` (Anthropic recommended) or fallback to nomic | Anthropic itself has no first-party embeddings |

Choice is per-task, configurable per tenant in `ai_engine.embed_provider`.

### Schema additions

Add to `packages/db/src/schema.ts`:

```ts
export const ontologyChunks = pgTable("ontology_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Tenant-scoped if customer overrides, else NULL = global ontology
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  framework: text("framework").notNull(),       // "iso27001-2022"
  anchorRef: text("anchor_ref").notNull(),      // "A.8.32"
  clusterId: text("cluster_id"),                // "cluster:change-management"
  chunkText: text("chunk_text").notNull(),
  embeddingMistral: vector("embedding_mistral", { dimensions: 1024 }),
  embeddingNomic: vector("embedding_nomic", { dimensions: 768 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  hnswMistral: index("ontology_hnsw_mistral").using("hnsw", t.embeddingMistral.op("vector_cosine_ops")),
  hnswNomic: index("ontology_hnsw_nomic").using("hnsw", t.embeddingNomic.op("vector_cosine_ops")),
}));
```

Both columns coexist so a tenant can switch embedding model without re-ingesting.
Storage cost: ~10K chunks × (1024 + 768) × 4 bytes ≈ 70 MB per tenant. Trivial.

### Chunking strategy

The 10 cluster YAML files are decomposed into **anchor-level chunks**:

- Each `framework_anchors[]` entry → one chunk (objective + obligation_fr + cluster context).
- Each `policies[].title` + `principles_fr[]` → one chunk per principle.
- Each `procedures[].steps[]` → one chunk per step (compact).
- KPIs and BPMN structure are **not chunked** (retrieved by relational query).

Total per cluster: ~30-50 chunks. Total for 10 clusters: ~400 chunks.
Future frameworks add ~50 chunks each.

### Retrieval pattern

Agent-side (PydanticAI tool):

```python
async def search_anchors(
    query: str,
    framework: str | None = None,
    top_k: int = 5,
    min_score: float = 0.7,
) -> list[AnchorMatch]:
    embedding = await embed_provider.embed(query)
    return await rag_client.search_chunks(
        embedding=embedding,
        framework_filter=framework,
        top_k=top_k,
        min_score=min_score,
    )
```

The agent uses returned `anchor_ref` strings; the hallucination guard
(Q01) verifies each cited anchor exists in `ontologies/`.

### Ingestion pipeline

A one-shot Python script `services/extractor/ingest_ontologies.py` walks
`ontologies/clusters/*.yaml`, splits into chunks, embeds via the configured
provider, and inserts. Run on:

- First boot of a fresh install.
- Each ontology version bump (CLI: `egide ontology reindex`).
- Cluster file added (CI hook).

## Security controls (cf. ADR 014, LLM08)

- **Tenant isolation**: `ontology_chunks` partitioned by `tenant_id` ;
  queries always filter by `(tenant_id = ? OR tenant_id IS NULL)` for
  the global ontology + tenant overrides. Cross-tenant retrieval
  impossible by construction (PG RLS additional layer in production).
- **Signed ingestion**: each chunk row carries a `source_signature`
  (Ed25519 by maintainer key) ; signatures verified by the RAG retriever
  at query time ; tampered chunks rejected.
- **Embed model coherence**: each chunk records its `embed_model` ;
  retriever rejects with `EMBED_MODEL_MISMATCH` if the query model
  differs (no silent degradation).
- **Read-only at runtime**: AI workers cannot write to
  `ontology_chunks` ; ingestion is performed by the offline script
  `services/extractor/ingest_ontologies.py` only.
- **Adversarial eval**: the eval suite (ADR 009) includes test cases
  for similar-but-semantically-inverted texts to catch embedding
  weaknesses.

## Consequences

- pgvector extension must be enabled in `deploy/scripts/init-db.sql`.
- `packages/db` adds the `ontology_chunks` table.
- A `services/rag` is **not** a separate service — it's a thin TS module
  in `apps/api/src/rag/` that wraps SQL queries and LLM router embed
  calls. Avoids extra ops complexity.
- Embedding models add to the LLM Router: `embed()` method already in
  `LLMProvider` interface (ADR 004).
- Hallucination guard becomes mandatory in `BaseAgent` — any anchor cited
  by an LLM is verified against `ontology_chunks.anchor_ref` before persist.
- For air-gapped Enterprise: pre-compute all embeddings on the install
  bundle ; no embed call needed at runtime if the customer never adds a
  custom ontology.

## Open questions

- Hybrid search (vector + tsvector full-text)? Probably yes from M3+
  for better recall on rare anchors. Use PG `&&` operator with rank fusion.
- Per-tenant fine-tuning of the embedding via local LoRA? Far M9+. Likely no.
