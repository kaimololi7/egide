// Package application contains the use cases for the validator service.
//
// ValidateUseCase fetches a pyramid graph from storage and runs the
// domain engine against it. The handler layer never touches domain logic
// directly — it goes through this use case.
package application

import (
	"context"
	"errors"

	"github.com/egide/egide/services/validator/internal/domain"
)

// PyramidRepository is the port the use case depends on (hexagonal: input port).
// The postgres adapter implements it.
type PyramidRepository interface {
	// FetchGraph returns the full snapshot of a pyramid for a given tenant.
	// Returns ErrNotFound if the pyramid does not exist.
	FetchGraph(ctx context.Context, tenantID, pyramidID string) (*domain.PyramidGraph, error)
}

// ErrNotFound is returned by the repository when the pyramid is absent.
var ErrNotFound = errors.New("pyramid not found")

// ValidateRequest is the input to the use case.
type ValidateRequest struct {
	TenantID  string
	PyramidID string
	// Inline graph: when non-nil, skip the DB fetch (used for ad-hoc artifact checks).
	InlineGraph *domain.PyramidGraph
}

// ValidateUseCase orchestrates validation: DB fetch + engine.
type ValidateUseCase struct {
	repo   PyramidRepository
	engine *domain.Engine
}

// NewValidateUseCase constructs the use case with its dependencies injected.
func NewValidateUseCase(repo PyramidRepository, engine *domain.Engine) *ValidateUseCase {
	return &ValidateUseCase{repo: repo, engine: engine}
}

// Execute runs validation and returns the result.
func (uc *ValidateUseCase) Execute(ctx context.Context, req ValidateRequest) (domain.ValidationResult, error) {
	var graph *domain.PyramidGraph
	if req.InlineGraph != nil {
		graph = req.InlineGraph
	} else {
		var err error
		graph, err = uc.repo.FetchGraph(ctx, req.TenantID, req.PyramidID)
		if err != nil {
			return domain.ValidationResult{}, err
		}
	}
	return uc.engine.Validate(graph), nil
}
