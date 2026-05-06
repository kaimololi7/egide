// Package domain — rule interface.
//
// Every deterministic rule implements Rule. The engine calls Evaluate
// for each rule and aggregates results into a ValidationResult.
package domain

// Rule is the interface every deterministic coherence rule must implement.
type Rule interface {
	// ID returns the stable rule identifier, e.g. "R-001".
	ID() string
	// Description returns a short human-readable description.
	Description() string
	// Severity returns the default severity of violations.
	Severity() Severity
	// Evaluate runs the rule against the graph and returns any violations.
	// An empty slice means the rule passed.
	Evaluate(graph *PyramidGraph) []ValidationIssue
}

// Engine runs all registered rules over a PyramidGraph.
type Engine struct {
	rules []Rule
}

// NewEngine creates a new engine with the given rule set.
func NewEngine(rules []Rule) *Engine {
	return &Engine{rules: rules}
}

// Validate executes all rules and returns a consolidated ValidationResult.
func (e *Engine) Validate(graph *PyramidGraph) ValidationResult {
	var issues []ValidationIssue
	passed := 0

	for _, r := range e.rules {
		violations := r.Evaluate(graph)
		if len(violations) == 0 {
			passed++
		} else {
			issues = append(issues, violations...)
		}
	}

	return ValidationResult{
		PyramidID:      graph.PyramidID,
		Passed:         len(issues) == 0,
		Issues:         issues,
		RulesEvaluated: len(e.rules),
		RulesPassed:    passed,
	}
}
