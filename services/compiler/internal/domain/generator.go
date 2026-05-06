// Package domain — Generator port (hexagonal output port).
//
// Every compilation target (Rego, Ansible, Kyverno…) implements this
// interface. The compiler only depends on this abstraction; concrete
// implementations live in internal/generators/*.
package domain

import "context"

// Target is the name of a compilation target.
type Target string

const (
	TargetRego    Target = "rego"
	TargetAnsible Target = "ansible" // M6+
	TargetKyverno Target = "kyverno" // M10+
)

// TestResult is the output of running an Intent's fixtures against the
// generated artifact.
type TestResult struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Expect  string `json:"expect"`
	Got     string `json:"got"`
	Message string `json:"message,omitempty"`
}

// Generator compiles an Intent to a target-specific artifact.
type Generator interface {
	// Target returns the name of the compilation target.
	Target() Target

	// Compile transforms an Intent into executable code.
	Compile(ctx context.Context, intent *Intent) (*CompiledArtifact, error)

	// Test runs the Intent's fixtures against the compiled artifact and
	// returns the test results.
	Test(ctx context.Context, artifact *CompiledArtifact, intent *Intent) ([]TestResult, error)
}
