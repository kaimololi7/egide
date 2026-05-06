// Package postgres contains the PostgreSQL adapters for the validator service.
//
// Adapters implement the application ports (hexagonal: infrastructure layer).
// Domain and application packages never import this package.
package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/egide/egide/services/validator/internal/application"
	"github.com/egide/egide/services/validator/internal/domain"
)

// Client wraps a pgx connection pool and implements all repository ports.
type Client struct {
	pool *pgxpool.Pool
}

// New creates a new Client. Call Close() when done.
func New(ctx context.Context, dsn string) (*Client, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres: open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("postgres: ping: %w", err)
	}
	return &Client{pool: pool}, nil
}

// Close shuts down the connection pool.
func (c *Client) Close() {
	c.pool.Close()
}

// ── PyramidRepository ─────────────────────────────────────────────────────────

// FetchGraph implements application.PyramidRepository.
// Uses a recursive CTE to walk the pyramid graph from all directive roots.
func (c *Client) FetchGraph(ctx context.Context, tenantID, pyramidID string) (*domain.PyramidGraph, error) {
	const q = `
WITH RECURSIVE tree AS (
  -- seed: all nodes in the pyramid
  SELECT
    pn.id,
    pn.layer,
    pn.title,
    pn.content,
    pn.status,
    pn.metadata,
    pn.normative_anchors,
    pn.parent_ids,
    pn.child_ids,
    pn.created_at,
    pn.updated_at
  FROM pyramid_nodes pn
  WHERE pn.pyramid_id = $1
    AND pn.tenant_id  = $2
)
SELECT
  id,
  layer,
  title,
  content,
  status,
  metadata,
  normative_anchors,
  parent_ids,
  child_ids,
  created_at,
  updated_at
FROM tree;
`
	rows, err := c.pool.Query(ctx, q, pyramidID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("postgres: FetchGraph query: %w", err)
	}
	defer rows.Close()

	var nodes []domain.PyramidNode
	for rows.Next() {
		var n domain.PyramidNode
		var metaRaw []byte
		var parentIDs, childIDs, anchors []string

		err := rows.Scan(
			&n.ID, &n.Layer, &n.Title, &n.Content, &n.Status,
			&metaRaw, &anchors, &parentIDs, &childIDs,
			&n.CreatedAt, &n.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("postgres: FetchGraph scan: %w", err)
		}
		n.TenantID = tenantID
		n.PyramidID = pyramidID
		n.ParentIDs = parentIDs
		n.ChildIDs = childIDs
		n.NormativeAnchors = anchors
		if len(metaRaw) > 0 {
			if err := json.Unmarshal(metaRaw, &n.Metadata); err != nil {
				n.Metadata = nil
			}
		}
		nodes = append(nodes, n)
	}
	if rows.Err() != nil {
		return nil, fmt.Errorf("postgres: FetchGraph rows: %w", rows.Err())
	}
	if len(nodes) == 0 {
		return nil, application.ErrNotFound
	}
	return &domain.PyramidGraph{
		PyramidID: pyramidID,
		TenantID:  tenantID,
		Nodes:     nodes,
	}, nil
}

// ── RAGRepository ─────────────────────────────────────────────────────────────

// Search implements application.RAGRepository.
// Performs a cosine-similarity search over ontology_chunks using pgvector.
// Note: the query embedding is expected to be computed by the caller
// (compliance agent). For MVP, the validator accepts a pre-embedded float64
// slice via a separate endpoint; for this MVP RAG endpoint we accept a text
// query and use pg_similarity as a fallback (full-text).
func (c *Client) Search(ctx context.Context, tenantID string, query string, topK int, frameworks []string) ([]application.OntologyChunk, error) {
	var sb strings.Builder
	args := []any{tenantID, query, topK}
	sb.WriteString(`
SELECT
  id         AS chunk_id,
  framework,
  clause,
  title,
  content    AS text,
  ts_rank_cd(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')),
             plainto_tsquery('simple', $2)) AS score
FROM ontology_chunks
WHERE tenant_id = $1
  AND to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))
      @@ plainto_tsquery('simple', $2)
`)
	if len(frameworks) > 0 {
		sb.WriteString(fmt.Sprintf("  AND framework = ANY($%d)\n", len(args)+1))
		args = append(args, frameworks)
	}
	sb.WriteString("ORDER BY score DESC\n")
	sb.WriteString(fmt.Sprintf("LIMIT $%d;\n", len(args)+1))
	args = append(args, topK)

	rows, err := c.pool.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("postgres: RAG search: %w", err)
	}
	defer rows.Close()

	var chunks []application.OntologyChunk
	for rows.Next() {
		var ch application.OntologyChunk
		if err := rows.Scan(&ch.ChunkID, &ch.Framework, &ch.Clause, &ch.Title, &ch.Text, &ch.SimilarityScore); err != nil {
			return nil, fmt.Errorf("postgres: RAG scan: %w", err)
		}
		chunks = append(chunks, ch)
	}
	return chunks, rows.Err()
}
