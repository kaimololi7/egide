// Package application contains the compiler use cases (hexagonal: application layer).
//
// CompileUseCase: given an Intent and a target, delegate to the matching
// Generator and return a CompiledArtifact.
package application

import (
	"context"
	"fmt"

	"github.com/egide/egide/services/compiler/internal/domain"
)

// CompileRequest is the input to the compile use case.
type CompileRequest struct {
	Intent *domain.Intent
	Target domain.Target
}

// CompileUseCase wires generators together and routes compilation requests.
type CompileUseCase struct {
	generators map[domain.Target]domain.Generator
}

// NewCompileUseCase constructs the use case with injected generators.
func NewCompileUseCase(gens ...domain.Generator) *CompileUseCase {
	m := make(map[domain.Target]domain.Generator, len(gens))
	for _, g := range gens {
		m[g.Target()] = g
	}
	return &CompileUseCase{generators: m}
}

// Compile delegates to the matching generator.
func (uc *CompileUseCase) Compile(ctx context.Context, req CompileRequest) (*domain.CompiledArtifact, error) {
	gen, ok := uc.generators[req.Target]
	if !ok {
		return nil, fmt.Errorf("no generator registered for target %q", req.Target)
	}
	return gen.Compile(ctx, req.Intent)
}

// Test runs the fixtures of an artifact via the matching generator.
func (uc *CompileUseCase) Test(ctx context.Context, artifact *domain.CompiledArtifact, intent *domain.Intent) ([]domain.TestResult, error) {
	gen, ok := uc.generators[domain.Target(artifact.Target)]
	if !ok {
		return nil, fmt.Errorf("no generator registered for target %q", artifact.Target)
	}
	return gen.Test(ctx, artifact, intent)
}

// SupportedTargets lists the registered compilation targets.
func (uc *CompileUseCase) SupportedTargets() []domain.Target {
	targets := make([]domain.Target, 0, len(uc.generators))
	for t := range uc.generators {
		targets = append(targets, t)
	}
	return targets
}
