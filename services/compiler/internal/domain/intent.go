// Package domain contains the compiler domain types.
//
// The Intent IR (Target-agnostic Intent) is the intermediate representation
// between the human governance pyramid and executable policy artifacts.
// Specification: docs/specs/intent-ir.md
package domain

import "time"

// Severity determines the enforcement mode on violation.
type Severity string

const (
	SeverityError   Severity = "error"   // blocks deployment
	SeverityWarning Severity = "warning" // audits only
	SeverityInfo    Severity = "info"    // records only
)

// Op is a comparison operator in a RequiredState assertion.
type Op string

const (
	OpEq         Op = "=="
	OpNe         Op = "!="
	OpLt         Op = "<"
	OpLte        Op = "<="
	OpGt         Op = ">"
	OpGte        Op = ">="
	OpIn         Op = "in"
	OpNotIn      Op = "not_in"
	OpRegexMatch Op = "regex_match"
)

// RequiredStateAssertion is a single assertion in an Intent.
// All assertions must pass (conjunctive) for compliance.
type RequiredStateAssertion struct {
	Path  string `json:"path"`
	Op    Op     `json:"op"`
	Value any    `json:"value"`
}

// Exception is a resource excluded from the Intent's scope.
type Exception struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// Selector narrows the scope of resources the Intent applies to.
type Selector struct {
	Kinds      []string            `json:"kinds"`
	Scope      string              `json:"scope,omitempty"`
	Labels     map[string][]string `json:"labels,omitempty"`
	Exceptions []Exception         `json:"exceptions,omitempty"`
}

// SourceTrace links an Intent back to the pyramid artifact that produced it.
type SourceTrace struct {
	PyramidArtifactID      string   `json:"pyramid_artifact_id"`
	NormativeAnchors       []string `json:"normative_anchors"`
	DirectiveID            string   `json:"directive_id"`
	DirectiveSignatureHash string   `json:"directive_signature_hash,omitempty"`
}

// RegoHints provides target-specific hints for the Rego generator.
type RegoHints struct {
	Package  string `json:"package"`
	Decision string `json:"decision"` // "deny" | "allow" | "warn"
}

// TargetHints contains per-target generation hints.
type TargetHints struct {
	Rego *RegoHints `json:"rego,omitempty"`
}

// IntentFixture is a test case for an Intent.
type IntentFixture struct {
	Name   string         `json:"name"`
	Data   map[string]any `json:"data"`
	Expect string         `json:"expect"` // "allow" | "deny"
}

// IntentFixtures groups positive and negative test cases.
type IntentFixtures struct {
	Positive []IntentFixture `json:"positive"`
	Negative []IntentFixture `json:"negative"`
}

// IntentMetadata holds authorship and hashing info.
type IntentMetadata struct {
	Owner       string    `json:"owner,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	ContentHash string    `json:"content_hash,omitempty"`
}

// Intent is the TAI intermediate representation.
// See docs/specs/intent-ir.md for the full specification.
type Intent struct {
	ID                 string                   `json:"id"`
	Version            string                   `json:"version"`
	Title              string                   `json:"title"`
	Description        string                   `json:"description"`
	Selector           Selector                 `json:"selector"`
	RequiredState      []RequiredStateAssertion `json:"required_state"`
	ActionsOnViolation []string                 `json:"actions_on_violation"`
	Severity           Severity                 `json:"severity"`
	SourceTrace        SourceTrace              `json:"source_trace"`
	TargetHints        TargetHints              `json:"target_hints,omitempty"`
	Fixtures           IntentFixtures           `json:"fixtures,omitempty"`
	Metadata           IntentMetadata           `json:"metadata"`
}

// CompiledArtifact is the result of compiling an Intent to a target.
type CompiledArtifact struct {
	IntentID    string `json:"intent_id"`
	Target      string `json:"target"`  // e.g. "rego"
	Content     string `json:"content"` // generated code
	ContentHash string `json:"content_hash"`
	TestsPassed int    `json:"tests_passed"`
	TestsTotal  int    `json:"tests_total"`
}
