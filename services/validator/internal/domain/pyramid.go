// Package domain contains the Egide validator domain types.
//
// A PyramidNode is a single artifact in the governance pyramid
// (directive / policy / procedure / process / kpi). A PyramidGraph
// represents the full snapshot evaluated by the 25 rules.
package domain

import "time"

// Layer is the governance pyramid layer.
type Layer string

const (
	LayerDirective Layer = "directive"
	LayerPolicy    Layer = "policy"
	LayerProcedure Layer = "procedure"
	LayerProcess   Layer = "process"
	LayerKPI       Layer = "kpi"
)

// Severity of a validation issue.
type Severity string

const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
	SeverityInfo    Severity = "info"
)

// PyramidNode is a single node in the governance pyramid graph.
type PyramidNode struct {
	ID               string         `json:"id"`
	TenantID         string         `json:"tenant_id"`
	PyramidID        string         `json:"pyramid_id"`
	Layer            Layer          `json:"layer"`
	Title            string         `json:"title"`
	Content          string         `json:"content"`
	ParentIDs        []string       `json:"parent_ids"`
	ChildIDs         []string       `json:"child_ids"`
	NormativeAnchors []string       `json:"normative_anchors"` // e.g. ["ISO27001:2022 A.8.7"]
	Status           string         `json:"status"`            // draft|review|published
	Metadata         map[string]any `json:"metadata"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

// PyramidGraph is the full graph snapshot passed to rule evaluation.
type PyramidGraph struct {
	PyramidID string        `json:"pyramid_id"`
	TenantID  string        `json:"tenant_id"`
	Nodes     []PyramidNode `json:"nodes"`
}

// ValidationIssue is a single rule violation.
type ValidationIssue struct {
	RuleID         string   `json:"rule_id"`
	Description    string   `json:"description"`
	Severity       Severity `json:"severity"`
	AffectedNodeID string   `json:"affected_node_id,omitempty"`
}

// ValidationResult is the output of a full validation run.
type ValidationResult struct {
	PyramidID      string            `json:"pyramid_id"`
	Passed         bool              `json:"passed"`
	Issues         []ValidationIssue `json:"issues"`
	RulesEvaluated int               `json:"rules_evaluated"`
	RulesPassed    int               `json:"rules_passed"`
}
