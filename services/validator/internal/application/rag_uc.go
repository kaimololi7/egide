// Package application — RAG search use case.
//
// Performs a pgvector cosine similarity search over ontology_chunks,
// filtered by tenant_id and optional framework tags.
package application

import (
	"context"
)

// OntologyChunk is a ranked result from the RAG search.
type OntologyChunk struct {
	ChunkID         string  `json:"chunk_id"`
	Framework       string  `json:"framework"`
	Clause          string  `json:"clause"`
	Title           string  `json:"title"`
	Text            string  `json:"text"`
	SimilarityScore float64 `json:"similarity_score"`
}

// RAGRepository is the port for vector search (hexagonal: output port).
type RAGRepository interface {
	Search(ctx context.Context, tenantID string, query string, topK int, frameworks []string) ([]OntologyChunk, error)
}

// RAGSearchRequest is the input to the RAG use case.
type RAGSearchRequest struct {
	TenantID   string
	Query      string
	TopK       int
	Frameworks []string
}

// RAGUseCase handles semantic search over the normative knowledge base.
type RAGUseCase struct {
	repo RAGRepository
}

// NewRAGUseCase constructs the use case.
func NewRAGUseCase(repo RAGRepository) *RAGUseCase {
	return &RAGUseCase{repo: repo}
}

// Execute performs the vector search and returns ranked chunks.
func (uc *RAGUseCase) Execute(ctx context.Context, req RAGSearchRequest) ([]OntologyChunk, error) {
	topK := req.TopK
	if topK <= 0 || topK > 20 {
		topK = 5
	}
	return uc.repo.Search(ctx, req.TenantID, req.Query, topK, req.Frameworks)
}
