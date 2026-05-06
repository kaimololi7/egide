// Package rules contains the 25 deterministic coherence rules for the
// Egide governance pyramid (cf. ADR 006 + docs/roadmap.md sprint S6-S9).
//
// Rules are grouped:
//
//	R-001..R-005  Structural integrity (graph shape)
//	R-006..R-010  Orphan / unreachable detection
//	R-011..R-015  Normative anchor requirements
//	R-016..R-020  Layer ordering and hierarchy
//	R-021..R-025  Content quality (non-empty, no duplicates)
package rules

import (
	"fmt"
	"strings"

	"github.com/egide/egide/services/validator/internal/domain"
)

// All returns the complete set of 25 deterministic rules.
func All() []domain.Rule {
	return []domain.Rule{
		// Structural integrity
		&r001PyramidHasDirective{},
		&r002PyramidHasPolicy{},
		&r003PyramidHasProcedure{},
		&r004MaxDepth{},
		&r005NoCycles{},
		// Orphan / unreachable
		&r006NoOrphanPolicy{},
		&r007NoOrphanProcedure{},
		&r008NoOrphanProcess{},
		&r009NoOrphanKPI{},
		&r010AllNodesReachableFromDirective{},
		// Normative anchor requirements
		&r011DirectiveCitesAnchor{},
		&r012PolicyCitesAnchor{},
		&r013ProcedureDerivedFromPolicy{},
		&r014KPIMeasuresProcess{},
		&r015NoAnchorDuplicateInSiblings{},
		// Layer ordering and hierarchy
		&r016PolicyParentIsDirective{},
		&r017ProcedureParentIsPolicy{},
		&r018ProcessParentIsProcedureOrPolicy{},
		&r019KPIParentIsProcessOrProcedure{},
		&r020LayerDepthConsistency{},
		// Content quality
		&r021NodeTitleNonEmpty{},
		&r022NodeContentNonEmpty{},
		&r023NoDuplicateTitlesInLayer{},
		&r024PolicyHasAtLeastOneRequirement{},
		&r025MaxNodesPerLayer{},
	}
}

// ── R-001: Pyramid has at least one directive ─────────────────────────────────

type r001PyramidHasDirective struct{}

func (r *r001PyramidHasDirective) ID() string { return "R-001" }
func (r *r001PyramidHasDirective) Description() string {
	return "Pyramid must have at least one directive node"
}
func (r *r001PyramidHasDirective) Severity() domain.Severity { return domain.SeverityError }
func (r *r001PyramidHasDirective) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	for _, n := range g.Nodes {
		if n.Layer == domain.LayerDirective {
			return nil
		}
	}
	return []domain.ValidationIssue{{
		RuleID:      r.ID(),
		Description: r.Description(),
		Severity:    r.Severity(),
	}}
}

// ── R-002: Pyramid has at least one policy ────────────────────────────────────

type r002PyramidHasPolicy struct{}

func (r *r002PyramidHasPolicy) ID() string { return "R-002" }
func (r *r002PyramidHasPolicy) Description() string {
	return "Pyramid must have at least one policy node"
}
func (r *r002PyramidHasPolicy) Severity() domain.Severity { return domain.SeverityError }
func (r *r002PyramidHasPolicy) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	for _, n := range g.Nodes {
		if n.Layer == domain.LayerPolicy {
			return nil
		}
	}
	return []domain.ValidationIssue{{
		RuleID:      r.ID(),
		Description: r.Description(),
		Severity:    r.Severity(),
	}}
}

// ── R-003: Pyramid has at least one procedure ─────────────────────────────────

type r003PyramidHasProcedure struct{}

func (r *r003PyramidHasProcedure) ID() string { return "R-003" }
func (r *r003PyramidHasProcedure) Description() string {
	return "Pyramid must have at least one procedure node"
}
func (r *r003PyramidHasProcedure) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r003PyramidHasProcedure) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	for _, n := range g.Nodes {
		if n.Layer == domain.LayerProcedure {
			return nil
		}
	}
	return []domain.ValidationIssue{{
		RuleID:      r.ID(),
		Description: r.Description(),
		Severity:    r.Severity(),
	}}
}

// ── R-004: Max depth ≤ 6 ──────────────────────────────────────────────────────

type r004MaxDepth struct{}

func (r *r004MaxDepth) ID() string                { return "R-004" }
func (r *r004MaxDepth) Description() string       { return "Pyramid depth must not exceed 6 levels" }
func (r *r004MaxDepth) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r004MaxDepth) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	if computeDepth(g) > 6 {
		return []domain.ValidationIssue{{
			RuleID:      r.ID(),
			Description: r.Description(),
			Severity:    r.Severity(),
		}}
	}
	return nil
}

// ── R-005: No cycles in the graph ────────────────────────────────────────────

type r005NoCycles struct{}

func (r *r005NoCycles) ID() string                { return "R-005" }
func (r *r005NoCycles) Description() string       { return "Pyramid graph must be acyclic (DAG)" }
func (r *r005NoCycles) Severity() domain.Severity { return domain.SeverityError }
func (r *r005NoCycles) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	if hasCycle(g) {
		return []domain.ValidationIssue{{
			RuleID:      r.ID(),
			Description: r.Description(),
			Severity:    r.Severity(),
		}}
	}
	return nil
}

// ── R-006: No orphan policies ────────────────────────────────────────────────

type r006NoOrphanPolicy struct{}

func (r *r006NoOrphanPolicy) ID() string { return "R-006" }
func (r *r006NoOrphanPolicy) Description() string {
	return "Every policy must have at least one parent node"
}
func (r *r006NoOrphanPolicy) Severity() domain.Severity { return domain.SeverityError }
func (r *r006NoOrphanPolicy) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return orphansOfLayer(g, domain.LayerPolicy, r.ID(), r.Description(), r.Severity())
}

// ── R-007: No orphan procedures ──────────────────────────────────────────────

type r007NoOrphanProcedure struct{}

func (r *r007NoOrphanProcedure) ID() string { return "R-007" }
func (r *r007NoOrphanProcedure) Description() string {
	return "Every procedure must have at least one parent node"
}
func (r *r007NoOrphanProcedure) Severity() domain.Severity { return domain.SeverityError }
func (r *r007NoOrphanProcedure) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return orphansOfLayer(g, domain.LayerProcedure, r.ID(), r.Description(), r.Severity())
}

// ── R-008: No orphan processes ────────────────────────────────────────────────

type r008NoOrphanProcess struct{}

func (r *r008NoOrphanProcess) ID() string { return "R-008" }
func (r *r008NoOrphanProcess) Description() string {
	return "Every process must have at least one parent node"
}
func (r *r008NoOrphanProcess) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r008NoOrphanProcess) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return orphansOfLayer(g, domain.LayerProcess, r.ID(), r.Description(), r.Severity())
}

// ── R-009: No orphan KPIs ────────────────────────────────────────────────────

type r009NoOrphanKPI struct{}

func (r *r009NoOrphanKPI) ID() string                { return "R-009" }
func (r *r009NoOrphanKPI) Description() string       { return "Every KPI must have at least one parent node" }
func (r *r009NoOrphanKPI) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r009NoOrphanKPI) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return orphansOfLayer(g, domain.LayerKPI, r.ID(), r.Description(), r.Severity())
}

// ── R-010: All nodes reachable from a directive ───────────────────────────────

type r010AllNodesReachableFromDirective struct{}

func (r *r010AllNodesReachableFromDirective) ID() string { return "R-010" }
func (r *r010AllNodesReachableFromDirective) Description() string {
	return "All nodes must be reachable from at least one directive"
}
func (r *r010AllNodesReachableFromDirective) Severity() domain.Severity { return domain.SeverityError }
func (r *r010AllNodesReachableFromDirective) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	reachable := reachableFromDirectives(g)
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer == domain.LayerDirective {
			continue // directives are roots
		}
		if !reachable[n.ID] {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: node '%s' (%s) is unreachable from any directive", r.Description(), n.Title, n.ID),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-011: Directive cites at least one normative anchor ──────────────────────

type r011DirectiveCitesAnchor struct{}

func (r *r011DirectiveCitesAnchor) ID() string { return "R-011" }
func (r *r011DirectiveCitesAnchor) Description() string {
	return "Every directive must cite at least one normative anchor"
}
func (r *r011DirectiveCitesAnchor) Severity() domain.Severity { return domain.SeverityError }
func (r *r011DirectiveCitesAnchor) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return nodesWithoutAnchors(g, domain.LayerDirective, r.ID(), r.Description(), r.Severity())
}

// ── R-012: Policy cites at least one normative anchor ────────────────────────

type r012PolicyCitesAnchor struct{}

func (r *r012PolicyCitesAnchor) ID() string { return "R-012" }
func (r *r012PolicyCitesAnchor) Description() string {
	return "Every policy must cite at least one normative anchor"
}
func (r *r012PolicyCitesAnchor) Severity() domain.Severity { return domain.SeverityError }
func (r *r012PolicyCitesAnchor) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return nodesWithoutAnchors(g, domain.LayerPolicy, r.ID(), r.Description(), r.Severity())
}

// ── R-013: Procedure derived from policy ─────────────────────────────────────

type r013ProcedureDerivedFromPolicy struct{}

func (r *r013ProcedureDerivedFromPolicy) ID() string { return "R-013" }
func (r *r013ProcedureDerivedFromPolicy) Description() string {
	return "Every procedure must have at least one policy ancestor"
}
func (r *r013ProcedureDerivedFromPolicy) Severity() domain.Severity { return domain.SeverityError }
func (r *r013ProcedureDerivedFromPolicy) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	nodeMap := buildNodeMap(g)
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer != domain.LayerProcedure {
			continue
		}
		if !hasAncestorOfLayer(n.ID, domain.LayerPolicy, nodeMap) {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: procedure '%s' has no policy ancestor", r.Description(), n.Title),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-014: KPI measures a process or procedure ───────────────────────────────

type r014KPIMeasuresProcess struct{}

func (r *r014KPIMeasuresProcess) ID() string { return "R-014" }
func (r *r014KPIMeasuresProcess) Description() string {
	return "Every KPI must have a process or procedure ancestor"
}
func (r *r014KPIMeasuresProcess) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r014KPIMeasuresProcess) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	nodeMap := buildNodeMap(g)
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer != domain.LayerKPI {
			continue
		}
		hasProcess := hasAncestorOfLayer(n.ID, domain.LayerProcess, nodeMap)
		hasProcedure := hasAncestorOfLayer(n.ID, domain.LayerProcedure, nodeMap)
		if !hasProcess && !hasProcedure {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: KPI '%s' has no process/procedure ancestor", r.Description(), n.Title),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-015: No duplicate anchors in sibling nodes ──────────────────────────────

type r015NoAnchorDuplicateInSiblings struct{}

func (r *r015NoAnchorDuplicateInSiblings) ID() string { return "R-015" }
func (r *r015NoAnchorDuplicateInSiblings) Description() string {
	return "Sibling nodes (same parent) must not cite identical normative anchors"
}
func (r *r015NoAnchorDuplicateInSiblings) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r015NoAnchorDuplicateInSiblings) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	// Group children per parent, check anchor overlap within each group
	nodeMap := buildNodeMap(g)
	var issues []domain.ValidationIssue
	for _, parent := range g.Nodes {
		seen := map[string]string{} // anchor → first child ID
		for _, childID := range parent.ChildIDs {
			child, ok := nodeMap[childID]
			if !ok {
				continue
			}
			for _, anchor := range child.NormativeAnchors {
				if firstID, dup := seen[anchor]; dup {
					issues = append(issues, domain.ValidationIssue{
						RuleID:         r.ID(),
						Description:    fmt.Sprintf("%s: anchor '%s' duplicated in siblings %s and %s", r.Description(), anchor, firstID, child.ID),
						Severity:       r.Severity(),
						AffectedNodeID: child.ID,
					})
				} else {
					seen[anchor] = child.ID
				}
			}
		}
	}
	return issues
}

// ── R-016: Policy parent is directive ────────────────────────────────────────

type r016PolicyParentIsDirective struct{}

func (r *r016PolicyParentIsDirective) ID() string { return "R-016" }
func (r *r016PolicyParentIsDirective) Description() string {
	return "Every policy must have at least one directive parent"
}
func (r *r016PolicyParentIsDirective) Severity() domain.Severity { return domain.SeverityError }
func (r *r016PolicyParentIsDirective) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return nodesWithoutParentOfLayer(g, domain.LayerPolicy, domain.LayerDirective, r.ID(), r.Description(), r.Severity())
}

// ── R-017: Procedure parent is policy ────────────────────────────────────────

type r017ProcedureParentIsPolicy struct{}

func (r *r017ProcedureParentIsPolicy) ID() string { return "R-017" }
func (r *r017ProcedureParentIsPolicy) Description() string {
	return "Every procedure must have at least one policy parent"
}
func (r *r017ProcedureParentIsPolicy) Severity() domain.Severity { return domain.SeverityError }
func (r *r017ProcedureParentIsPolicy) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	return nodesWithoutParentOfLayer(g, domain.LayerProcedure, domain.LayerPolicy, r.ID(), r.Description(), r.Severity())
}

// ── R-018: Process parent is procedure or policy ─────────────────────────────

type r018ProcessParentIsProcedureOrPolicy struct{}

func (r *r018ProcessParentIsProcedureOrPolicy) ID() string { return "R-018" }
func (r *r018ProcessParentIsProcedureOrPolicy) Description() string {
	return "Every process must have a procedure or policy parent"
}
func (r *r018ProcessParentIsProcedureOrPolicy) Severity() domain.Severity {
	return domain.SeverityWarning
}
func (r *r018ProcessParentIsProcedureOrPolicy) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	nodeMap := buildNodeMap(g)
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer != domain.LayerProcess {
			continue
		}
		hasValidParent := false
		for _, pid := range n.ParentIDs {
			p, ok := nodeMap[pid]
			if !ok {
				continue
			}
			if p.Layer == domain.LayerProcedure || p.Layer == domain.LayerPolicy {
				hasValidParent = true
				break
			}
		}
		if !hasValidParent {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: process '%s' has no procedure/policy parent", r.Description(), n.Title),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-019: KPI parent is process or procedure ────────────────────────────────

type r019KPIParentIsProcessOrProcedure struct{}

func (r *r019KPIParentIsProcessOrProcedure) ID() string { return "R-019" }
func (r *r019KPIParentIsProcessOrProcedure) Description() string {
	return "Every KPI must have a process or procedure parent"
}
func (r *r019KPIParentIsProcessOrProcedure) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r019KPIParentIsProcessOrProcedure) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	nodeMap := buildNodeMap(g)
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer != domain.LayerKPI {
			continue
		}
		hasValidParent := false
		for _, pid := range n.ParentIDs {
			p, ok := nodeMap[pid]
			if !ok {
				continue
			}
			if p.Layer == domain.LayerProcess || p.Layer == domain.LayerProcedure {
				hasValidParent = true
				break
			}
		}
		if !hasValidParent {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: KPI '%s' has no process/procedure parent", r.Description(), n.Title),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-020: Layer depth consistency (directive=0, policy=1, …) ────────────────

type r020LayerDepthConsistency struct{}

func (r *r020LayerDepthConsistency) ID() string { return "R-020" }
func (r *r020LayerDepthConsistency) Description() string {
	return "Node depth in graph must match expected layer order"
}
func (r *r020LayerDepthConsistency) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r020LayerDepthConsistency) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	// Expected minimum depth per layer (can be deeper for multi-level policies)
	expectedMinDepth := map[domain.Layer]int{
		domain.LayerDirective: 0,
		domain.LayerPolicy:    1,
		domain.LayerProcedure: 2,
		domain.LayerProcess:   2,
		domain.LayerKPI:       3,
	}
	depths := computeNodeDepths(g)
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		minDepth, ok := expectedMinDepth[n.Layer]
		if !ok {
			continue
		}
		if d, found := depths[n.ID]; found && d < minDepth {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: %s node '%s' at depth %d < %d", r.Description(), n.Layer, n.Title, d, minDepth),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-021: Node title is non-empty ───────────────────────────────────────────

type r021NodeTitleNonEmpty struct{}

func (r *r021NodeTitleNonEmpty) ID() string                { return "R-021" }
func (r *r021NodeTitleNonEmpty) Description() string       { return "Every node must have a non-empty title" }
func (r *r021NodeTitleNonEmpty) Severity() domain.Severity { return domain.SeverityError }
func (r *r021NodeTitleNonEmpty) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if strings.TrimSpace(n.Title) == "" {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: node %s has empty title", r.Description(), n.ID),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-022: Node content is non-empty ─────────────────────────────────────────

type r022NodeContentNonEmpty struct{}

func (r *r022NodeContentNonEmpty) ID() string { return "R-022" }
func (r *r022NodeContentNonEmpty) Description() string {
	return "Every node must have non-empty content"
}
func (r *r022NodeContentNonEmpty) Severity() domain.Severity { return domain.SeverityError }
func (r *r022NodeContentNonEmpty) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if strings.TrimSpace(n.Content) == "" {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: node '%s' (%s) has empty content", r.Description(), n.Title, n.ID),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-023: No duplicate titles within the same layer ─────────────────────────

type r023NoDuplicateTitlesInLayer struct{}

func (r *r023NoDuplicateTitlesInLayer) ID() string { return "R-023" }
func (r *r023NoDuplicateTitlesInLayer) Description() string {
	return "No two nodes of the same layer may share the same title (case-insensitive)"
}
func (r *r023NoDuplicateTitlesInLayer) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r023NoDuplicateTitlesInLayer) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	seen := map[string]map[string]string{} // layer → lower(title) → first node ID
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		layer := string(n.Layer)
		if seen[layer] == nil {
			seen[layer] = map[string]string{}
		}
		key := strings.ToLower(strings.TrimSpace(n.Title))
		if firstID, dup := seen[layer][key]; dup {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: title '%s' duplicated in %s (nodes %s and %s)", r.Description(), n.Title, layer, firstID, n.ID),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		} else {
			seen[layer][key] = n.ID
		}
	}
	return issues
}

// ── R-024: Policy has at least one requirement sentence ─────────────────────

type r024PolicyHasAtLeastOneRequirement struct{}

func (r *r024PolicyHasAtLeastOneRequirement) ID() string { return "R-024" }
func (r *r024PolicyHasAtLeastOneRequirement) Description() string {
	return "Every policy content must contain at least one MUST/SHALL/SHOULD obligation"
}
func (r *r024PolicyHasAtLeastOneRequirement) Severity() domain.Severity {
	return domain.SeverityWarning
}
func (r *r024PolicyHasAtLeastOneRequirement) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	keywords := []string{"must", "shall", "should", "doit", "devra", "interdit", "prohibited"}
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer != domain.LayerPolicy {
			continue
		}
		lower := strings.ToLower(n.Content)
		found := false
		for _, kw := range keywords {
			if strings.Contains(lower, kw) {
				found = true
				break
			}
		}
		if !found {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         r.ID(),
				Description:    fmt.Sprintf("%s: policy '%s' has no obligation keyword", r.Description(), n.Title),
				Severity:       r.Severity(),
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

// ── R-025: Max 50 nodes per layer ────────────────────────────────────────────

type r025MaxNodesPerLayer struct{}

func (r *r025MaxNodesPerLayer) ID() string { return "R-025" }
func (r *r025MaxNodesPerLayer) Description() string {
	return "No layer may contain more than 50 nodes (maintainability limit)"
}
func (r *r025MaxNodesPerLayer) Severity() domain.Severity { return domain.SeverityWarning }
func (r *r025MaxNodesPerLayer) Evaluate(g *domain.PyramidGraph) []domain.ValidationIssue {
	const maxPerLayer = 50
	counts := map[domain.Layer]int{}
	for _, n := range g.Nodes {
		counts[n.Layer]++
	}
	var issues []domain.ValidationIssue
	for layer, count := range counts {
		if count > maxPerLayer {
			issues = append(issues, domain.ValidationIssue{
				RuleID:      r.ID(),
				Description: fmt.Sprintf("%s: layer %s has %d nodes (max %d)", r.Description(), layer, count, maxPerLayer),
				Severity:    r.Severity(),
			})
		}
	}
	return issues
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

func buildNodeMap(g *domain.PyramidGraph) map[string]*domain.PyramidNode {
	m := make(map[string]*domain.PyramidNode, len(g.Nodes))
	for i := range g.Nodes {
		m[g.Nodes[i].ID] = &g.Nodes[i]
	}
	return m
}

func orphansOfLayer(g *domain.PyramidGraph, layer domain.Layer, ruleID, desc string, sev domain.Severity) []domain.ValidationIssue {
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer == layer && len(n.ParentIDs) == 0 {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         ruleID,
				Description:    fmt.Sprintf("%s: %s node '%s' has no parents", desc, layer, n.Title),
				Severity:       sev,
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

func nodesWithoutAnchors(g *domain.PyramidGraph, layer domain.Layer, ruleID, desc string, sev domain.Severity) []domain.ValidationIssue {
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer == layer && len(n.NormativeAnchors) == 0 {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         ruleID,
				Description:    fmt.Sprintf("%s: %s node '%s' cites no normative anchor", desc, layer, n.Title),
				Severity:       sev,
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

func nodesWithoutParentOfLayer(g *domain.PyramidGraph, childLayer, parentLayer domain.Layer, ruleID, desc string, sev domain.Severity) []domain.ValidationIssue {
	nodeMap := buildNodeMap(g)
	var issues []domain.ValidationIssue
	for _, n := range g.Nodes {
		if n.Layer != childLayer {
			continue
		}
		hasParent := false
		for _, pid := range n.ParentIDs {
			if p, ok := nodeMap[pid]; ok && p.Layer == parentLayer {
				hasParent = true
				break
			}
		}
		if !hasParent {
			issues = append(issues, domain.ValidationIssue{
				RuleID:         ruleID,
				Description:    fmt.Sprintf("%s: %s node '%s' has no %s parent", desc, childLayer, n.Title, parentLayer),
				Severity:       sev,
				AffectedNodeID: n.ID,
			})
		}
	}
	return issues
}

func reachableFromDirectives(g *domain.PyramidGraph) map[string]bool {
	nodeMap := buildNodeMap(g)
	reachable := map[string]bool{}
	var visit func(id string)
	visit = func(id string) {
		if reachable[id] {
			return
		}
		reachable[id] = true
		n, ok := nodeMap[id]
		if !ok {
			return
		}
		for _, cid := range n.ChildIDs {
			visit(cid)
		}
	}
	for _, n := range g.Nodes {
		if n.Layer == domain.LayerDirective {
			visit(n.ID)
		}
	}
	return reachable
}

func hasAncestorOfLayer(nodeID string, layer domain.Layer, nodeMap map[string]*domain.PyramidNode) bool {
	visited := map[string]bool{}
	var check func(id string) bool
	check = func(id string) bool {
		if visited[id] {
			return false
		}
		visited[id] = true
		n, ok := nodeMap[id]
		if !ok {
			return false
		}
		for _, pid := range n.ParentIDs {
			p, ok := nodeMap[pid]
			if !ok {
				continue
			}
			if p.Layer == layer || check(pid) {
				return true
			}
		}
		return false
	}
	return check(nodeID)
}

func computeDepth(g *domain.PyramidGraph) int {
	depths := computeNodeDepths(g)
	max := 0
	for _, d := range depths {
		if d > max {
			max = d
		}
	}
	return max
}

func computeNodeDepths(g *domain.PyramidGraph) map[string]int {
	nodeMap := buildNodeMap(g)
	depths := map[string]int{}
	var depth func(id string, visited map[string]bool) int
	depth = func(id string, visited map[string]bool) int {
		if d, ok := depths[id]; ok {
			return d
		}
		if visited[id] {
			return 0 // cycle guard
		}
		visited[id] = true
		n, ok := nodeMap[id]
		if !ok {
			return 0
		}
		if len(n.ParentIDs) == 0 {
			depths[id] = 0
			return 0
		}
		max := -1
		for _, pid := range n.ParentIDs {
			d := depth(pid, visited)
			if d > max {
				max = d
			}
		}
		depths[id] = max + 1
		return max + 1
	}
	for _, n := range g.Nodes {
		depth(n.ID, map[string]bool{})
	}
	return depths
}

func hasCycle(g *domain.PyramidGraph) bool {
	nodeMap := buildNodeMap(g)
	visited := map[string]bool{}
	inStack := map[string]bool{}
	var dfs func(id string) bool
	dfs = func(id string) bool {
		visited[id] = true
		inStack[id] = true
		n, ok := nodeMap[id]
		if !ok {
			inStack[id] = false
			return false
		}
		for _, cid := range n.ChildIDs {
			if !visited[cid] {
				if dfs(cid) {
					return true
				}
			} else if inStack[cid] {
				return true
			}
		}
		inStack[id] = false
		return false
	}
	for _, n := range g.Nodes {
		if !visited[n.ID] {
			if dfs(n.ID) {
				return true
			}
		}
	}
	return false
}
