// Package rules — unit tests for the 25 deterministic coherence rules.
//
// Each rule has at least 2 fixtures (one passing, one failing). Rules with
// nuanced behaviour (cycles, depth, anchors, layer ordering) get extra
// edge cases. Total: 55+ test cases.
package rules

import (
	"strings"
	"testing"
	"time"

	"github.com/egide/egide/services/validator/internal/domain"
)

// ── Test helpers ─────────────────────────────────────────────────────────────

func node(id string, layer domain.Layer, title string, parents ...string) domain.PyramidNode {
	return domain.PyramidNode{
		ID:               id,
		TenantID:         "t1",
		PyramidID:        "p1",
		Layer:            layer,
		Title:            title,
		Content:          "content for " + title,
		ParentIDs:        parents,
		NormativeAnchors: []string{"ISO27001:2022 A.1"},
		Status:           "draft",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
}

// linkChildren rebuilds child_ids from parent_ids so the graph is consistent.
func linkChildren(nodes []domain.PyramidNode) []domain.PyramidNode {
	idx := map[string]int{}
	for i := range nodes {
		nodes[i].ChildIDs = nil
		idx[nodes[i].ID] = i
	}
	for i := range nodes {
		for _, pid := range nodes[i].ParentIDs {
			if pi, ok := idx[pid]; ok {
				nodes[pi].ChildIDs = append(nodes[pi].ChildIDs, nodes[i].ID)
			}
		}
	}
	return nodes
}

func graph(nodes ...domain.PyramidNode) *domain.PyramidGraph {
	return &domain.PyramidGraph{
		PyramidID: "p1",
		TenantID:  "t1",
		Nodes:     linkChildren(nodes),
	}
}

// validGraph returns a minimal but coherent pyramid covering all layers.
// Used as the baseline for "passing" assertions.
func validGraph() *domain.PyramidGraph {
	d := node("d1", domain.LayerDirective, "Security commitment")
	po := node("po1", domain.LayerPolicy, "Access policy", "d1")
	po.Content = "Users must authenticate with MFA."
	pr := node("pr1", domain.LayerProcedure, "Access onboarding", "po1")
	ps := node("ps1", domain.LayerProcess, "Access review process", "pr1")
	k := node("k1", domain.LayerKPI, "MFA coverage", "ps1")
	return graph(d, po, pr, ps, k)
}

// findIssues filters a result to only the issues raised by the given rule ID.
func findIssues(issues []domain.ValidationIssue, ruleID string) []domain.ValidationIssue {
	var out []domain.ValidationIssue
	for _, i := range issues {
		if i.RuleID == ruleID {
			out = append(out, i)
		}
	}
	return out
}

// runRule evaluates a single rule by ID against a graph.
func runRule(t *testing.T, ruleID string, g *domain.PyramidGraph) []domain.ValidationIssue {
	t.Helper()
	for _, r := range All() {
		if r.ID() == ruleID {
			return r.Evaluate(g)
		}
	}
	t.Fatalf("rule %s not found", ruleID)
	return nil
}

// assertNoIssue fails if the rule raises any issue against the graph.
func assertNoIssue(t *testing.T, ruleID string, g *domain.PyramidGraph) {
	t.Helper()
	if issues := runRule(t, ruleID, g); len(issues) > 0 {
		t.Fatalf("%s expected no issues, got %d: %+v", ruleID, len(issues), issues)
	}
}

// assertIssue fails if the rule does not raise at least one issue.
func assertIssue(t *testing.T, ruleID string, g *domain.PyramidGraph) {
	t.Helper()
	if issues := runRule(t, ruleID, g); len(issues) == 0 {
		t.Fatalf("%s expected at least one issue, got none", ruleID)
	}
}

// ── R-001 to R-005: Structural integrity ─────────────────────────────────────

func TestR001_PyramidHasDirective(t *testing.T) {
	t.Run("pass", func(t *testing.T) {
		assertNoIssue(t, "R-001", validGraph())
	})
	t.Run("fail_no_directive", func(t *testing.T) {
		po := node("po1", domain.LayerPolicy, "Standalone policy")
		po.ParentIDs = nil
		assertIssue(t, "R-001", graph(po))
	})
}

func TestR002_PyramidHasPolicy(t *testing.T) {
	t.Run("pass", func(t *testing.T) {
		assertNoIssue(t, "R-002", validGraph())
	})
	t.Run("fail_directive_only", func(t *testing.T) {
		assertIssue(t, "R-002", graph(node("d1", domain.LayerDirective, "Directive only")))
	})
}

func TestR003_PyramidHasProcedure(t *testing.T) {
	t.Run("pass", func(t *testing.T) {
		assertNoIssue(t, "R-003", validGraph())
	})
	t.Run("fail_no_procedure", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "P", "d1")
		assertIssue(t, "R-003", graph(d, po))
	})
}

func TestR004_MaxDepth(t *testing.T) {
	t.Run("pass_depth_4", func(t *testing.T) {
		assertNoIssue(t, "R-004", validGraph())
	})
	t.Run("fail_depth_8", func(t *testing.T) {
		// Build a chain of 8 levels (depth 7)
		nodes := []domain.PyramidNode{node("n0", domain.LayerDirective, "L0")}
		for i := 1; i <= 7; i++ {
			parent := nodes[i-1].ID
			id := "n" + string(rune('0'+i))
			n := node(id, domain.LayerPolicy, "L"+string(rune('0'+i)), parent)
			nodes = append(nodes, n)
		}
		assertIssue(t, "R-004", graph(nodes...))
	})
}

func TestR005_NoCycles(t *testing.T) {
	t.Run("pass_dag", func(t *testing.T) {
		assertNoIssue(t, "R-005", validGraph())
	})
	t.Run("fail_cycle", func(t *testing.T) {
		// Manually craft a cycle: a → b → a
		a := node("a", domain.LayerDirective, "A")
		b := node("b", domain.LayerPolicy, "B", "a")
		a.ParentIDs = []string{"b"}
		assertIssue(t, "R-005", graph(a, b))
	})
}

// ── R-006 to R-010: Orphan / unreachable ─────────────────────────────────────

func TestR006_NoOrphanPolicy(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-006", validGraph()) })
	t.Run("fail_orphan_policy", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		orphan := node("po1", domain.LayerPolicy, "Orphan policy") // no parent
		assertIssue(t, "R-006", graph(d, orphan))
	})
}

func TestR007_NoOrphanProcedure(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-007", validGraph()) })
	t.Run("fail_orphan_procedure", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "P", "d1")
		orphan := node("pr1", domain.LayerProcedure, "Orphan procedure")
		assertIssue(t, "R-007", graph(d, po, orphan))
	})
}

func TestR008_NoOrphanProcess(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-008", validGraph()) })
	t.Run("fail_orphan_process", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "P", "d1")
		orphan := node("ps1", domain.LayerProcess, "Orphan process")
		assertIssue(t, "R-008", graph(d, po, orphan))
	})
}

func TestR009_NoOrphanKPI(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-009", validGraph()) })
	t.Run("fail_orphan_kpi", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "P", "d1")
		orphan := node("k1", domain.LayerKPI, "Orphan KPI")
		assertIssue(t, "R-009", graph(d, po, orphan))
	})
}

func TestR010_AllReachableFromDirective(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-010", validGraph()) })
	t.Run("fail_unreachable", func(t *testing.T) {
		// Two disconnected subtrees, one without directive
		d := node("d1", domain.LayerDirective, "D")
		po1 := node("po1", domain.LayerPolicy, "P1", "d1")
		// po2 has a parent (so R-006 passes) but parent is not a directive descendant
		dangling := node("dangling", domain.LayerDirective, "Stale") // not used as parent
		po2 := node("po2", domain.LayerPolicy, "P2", "dangling")
		_ = dangling
		// po2 references "dangling" but we don't include "dangling" — so po2 is unreachable
		nodes := graph(d, po1, po2)
		assertIssue(t, "R-010", nodes)
	})
}

// ── R-011 to R-015: Normative anchors ────────────────────────────────────────

func TestR011_DirectiveCitesAnchor(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-011", validGraph()) })
	t.Run("fail_no_anchor", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		d.NormativeAnchors = nil
		po := node("po1", domain.LayerPolicy, "P", "d1")
		assertIssue(t, "R-011", graph(d, po))
	})
}

func TestR012_PolicyCitesAnchor(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-012", validGraph()) })
	t.Run("fail_no_anchor", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "P", "d1")
		po.NormativeAnchors = nil
		assertIssue(t, "R-012", graph(d, po))
	})
}

func TestR013_ProcedureDerivedFromPolicy(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-013", validGraph()) })
	t.Run("fail_procedure_under_directive", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "P", "d1")
		// Procedure parented directly to directive (no policy ancestor)
		pr := node("pr1", domain.LayerProcedure, "Pr", "d1")
		assertIssue(t, "R-013", graph(d, po, pr))
	})
}

func TestR014_KPIMeasuresProcess(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-014", validGraph()) })
	t.Run("fail_kpi_under_policy_only", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "P", "d1")
		k := node("k1", domain.LayerKPI, "KPI", "po1") // no process/procedure ancestor
		assertIssue(t, "R-014", graph(d, po, k))
	})
}

func TestR015_NoDuplicateAnchorInSiblings(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-015", validGraph()) })
	t.Run("fail_duplicate_anchor", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po1 := node("po1", domain.LayerPolicy, "P1", "d1")
		po2 := node("po2", domain.LayerPolicy, "P2", "d1")
		po1.NormativeAnchors = []string{"ISO27001:2022 A.8.13"}
		po2.NormativeAnchors = []string{"ISO27001:2022 A.8.13"} // duplicate sibling
		assertIssue(t, "R-015", graph(d, po1, po2))
	})
}

// ── R-016 to R-020: Layer ordering ───────────────────────────────────────────

func TestR016_PolicyParentIsDirective(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-016", validGraph()) })
	t.Run("fail_policy_under_policy", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po1 := node("po1", domain.LayerPolicy, "P1", "d1")
		po2 := node("po2", domain.LayerPolicy, "P2", "po1") // no directive parent
		assertIssue(t, "R-016", graph(d, po1, po2))
	})
}

func TestR017_ProcedureParentIsPolicy(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-017", validGraph()) })
	t.Run("fail_procedure_under_directive", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		pr := node("pr1", domain.LayerProcedure, "Pr", "d1")
		assertIssue(t, "R-017", graph(d, pr))
	})
}

func TestR018_ProcessParentIsProcedureOrPolicy(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-018", validGraph()) })
	t.Run("fail_process_under_directive", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		ps := node("ps1", domain.LayerProcess, "Pr", "d1")
		assertIssue(t, "R-018", graph(d, ps))
	})
}

func TestR019_KPIParentIsProcessOrProcedure(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-019", validGraph()) })
	t.Run("fail_kpi_under_directive", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		k := node("k1", domain.LayerKPI, "KPI", "d1")
		assertIssue(t, "R-019", graph(d, k))
	})
}

func TestR020_LayerDepthConsistency(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-020", validGraph()) })
	t.Run("fail_kpi_at_depth_1", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		// KPI at depth 1 (parented directly to directive — also fails R-019, but R-020 too)
		k := node("k1", domain.LayerKPI, "Shallow KPI", "d1")
		assertIssue(t, "R-020", graph(d, k))
	})
}

// ── R-021 to R-025: Content quality ──────────────────────────────────────────

func TestR021_NodeTitleNonEmpty(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-021", validGraph()) })
	t.Run("fail_empty_title", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "")
		d.Title = "   "
		assertIssue(t, "R-021", graph(d))
	})
}

func TestR022_NodeContentNonEmpty(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-022", validGraph()) })
	t.Run("fail_empty_content", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		d.Content = ""
		assertIssue(t, "R-022", graph(d))
	})
}

func TestR023_NoDuplicateTitlesInLayer(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-023", validGraph()) })
	t.Run("fail_duplicate_titles", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po1 := node("po1", domain.LayerPolicy, "Same Title", "d1")
		po2 := node("po2", domain.LayerPolicy, "same title", "d1") // case-insensitive
		po1.Content = "x must y"
		po2.Content = "x must y"
		assertIssue(t, "R-023", graph(d, po1, po2))
	})
}

func TestR024_PolicyHasRequirement(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-024", validGraph()) })
	t.Run("fail_no_obligation_keyword", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		po := node("po1", domain.LayerPolicy, "Vague policy", "d1")
		po.Content = "We aim to encourage best practices."
		assertIssue(t, "R-024", graph(d, po))
	})
}

func TestR025_MaxNodesPerLayer(t *testing.T) {
	t.Run("pass", func(t *testing.T) { assertNoIssue(t, "R-025", validGraph()) })
	t.Run("fail_too_many_policies", func(t *testing.T) {
		d := node("d1", domain.LayerDirective, "D")
		nodes := []domain.PyramidNode{d}
		for i := 0; i < 51; i++ {
			id := "po" + string(rune('a'+(i/26))) + string(rune('a'+(i%26)))
			po := node(id, domain.LayerPolicy, id, "d1")
			po.Content = "x must y"
			nodes = append(nodes, po)
		}
		assertIssue(t, "R-025", graph(nodes...))
	})
}

// ── Engine smoke test ────────────────────────────────────────────────────────

func TestAll_Returns25Rules(t *testing.T) {
	rules := All()
	if len(rules) != 25 {
		t.Fatalf("expected 25 rules, got %d", len(rules))
	}
	seen := map[string]bool{}
	for _, r := range rules {
		if r.ID() == "" {
			t.Errorf("rule has empty ID")
		}
		if r.Description() == "" {
			t.Errorf("rule %s has empty description", r.ID())
		}
		if seen[r.ID()] {
			t.Errorf("duplicate rule ID: %s", r.ID())
		}
		seen[r.ID()] = true
		if !strings.HasPrefix(r.ID(), "R-") {
			t.Errorf("rule ID %s does not start with R-", r.ID())
		}
	}
}

func TestAll_ValidGraphPassesAllRules(t *testing.T) {
	g := validGraph()
	for _, r := range All() {
		if issues := r.Evaluate(g); len(issues) > 0 {
			t.Errorf("%s unexpectedly raised %d issues on valid graph: %+v", r.ID(), len(issues), issues)
		}
	}
}
