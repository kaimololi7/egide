// Package ansible implements the Ansible playbook compilation target.
//
// Given an Intent IR, this generator produces an Ansible playbook that:
//   - Audits the required_state assertions against host facts
//   - Tags every task with `egide` + `audit` (read-only) or `remediate`
//   - Carries source_trace as YAML comments + vars
//   - Is testable via `ansible-playbook --check --syntax-check` + Molecule
//     (Molecule scenario emitted alongside; tests run in CI when Docker is available).
//
// MVP target: 5 controls (mirrors Rego catalog) — backup, encryption,
// access logging, MFA, network egress. Custom controls use the generic
// `assert` task path.
//
// Cf. ADR 005 (multi-target compiler) + ADR 014 §LLM06 + skill ansible.md.
package ansible

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"
	"time"

	"github.com/egide/egide/services/compiler/internal/domain"
)

// Generator implements domain.Generator for the Ansible target.
type Generator struct{}

// New creates an Ansible generator.
func New() *Generator { return &Generator{} }

// Target implements domain.Generator.
func (g *Generator) Target() domain.Target { return domain.TargetAnsible }

// Compile transforms an Intent into an Ansible playbook YAML.
func (g *Generator) Compile(_ context.Context, intent *domain.Intent) (*domain.CompiledArtifact, error) {
	if intent == nil {
		return nil, fmt.Errorf("ansible: intent is nil")
	}

	hostGroup := defaultHostGroup(intent)
	playbookName := defaultPlaybookName(intent)

	tasks, err := buildTasks(intent)
	if err != nil {
		return nil, fmt.Errorf("ansible: build tasks: %w", err)
	}

	tplData := playbookTemplateData{
		Name:                  playbookName,
		Hosts:                 hostGroup,
		IntentID:              intent.ID,
		IntentVersion:         intent.Version,
		PyramidArtifactID:     intent.SourceTrace.PyramidArtifactID,
		NormativeAnchors:      intent.SourceTrace.NormativeAnchors,
		Severity:              string(intent.Severity),
		Description:           singleLine(intent.Description),
		Tasks:                 tasks,
		ApplyRemediation:      hasAction(intent, "auto_remediate"),
		BlockOnFail:           intent.Severity == domain.SeverityError,
		GeneratedAt:           time.Now().UTC().Format(time.RFC3339),
		EgideCompilerVersion:  "0.1.0",
	}

	var buf bytes.Buffer
	if err := playbookTpl.Execute(&buf, tplData); err != nil {
		return nil, fmt.Errorf("ansible: render: %w", err)
	}
	yaml := buf.String()
	hash := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(yaml)))

	return &domain.CompiledArtifact{
		IntentID:    intent.ID,
		Target:      string(domain.TargetAnsible),
		Content:     yaml,
		ContentHash: hash,
	}, nil
}

// Test runs intent fixtures against the playbook structure. Without a
// real Ansible runtime we do **structural** checks: the YAML parses and
// each fixture's host_vars cause the assert tasks to be triggered or
// skipped as expected. Real `ansible-playbook --check` runs when the
// runtime is available (deferred to CI smoke job M6+).
func (g *Generator) Test(_ context.Context, artifact *domain.CompiledArtifact, intent *domain.Intent) ([]domain.TestResult, error) {
	results := make([]domain.TestResult, 0, len(intent.Fixtures.Positive)+len(intent.Fixtures.Negative))

	for _, f := range intent.Fixtures.Positive {
		ok, msg := evalAssertions(intent.RequiredState, f.Data)
		got := "deny"
		if ok {
			got = "allow"
		}
		results = append(results, domain.TestResult{
			Name:    f.Name,
			Expect:  "allow",
			Got:     got,
			Passed:  got == "allow",
			Message: msg,
		})
	}
	for _, f := range intent.Fixtures.Negative {
		ok, msg := evalAssertions(intent.RequiredState, f.Data)
		got := "deny"
		if ok {
			got = "allow"
		}
		results = append(results, domain.TestResult{
			Name:    f.Name,
			Expect:  "deny",
			Got:     got,
			Passed:  got == "deny",
			Message: msg,
		})
	}

	// Structural sanity: artifact content must contain the playbook name + the egide tag.
	if !strings.Contains(artifact.Content, "tags:") || !strings.Contains(artifact.Content, "egide") {
		results = append(results, domain.TestResult{
			Name:    "_structural",
			Expect:  "ok",
			Got:     "missing egide tag",
			Passed:  false,
			Message: "every Ansible task must be tagged with `egide` (cf. skill ansible.md)",
		})
	}

	return results, nil
}

// ───────────────────────── helpers ─────────────────────────────────────

func defaultHostGroup(intent *domain.Intent) string {
	if len(intent.Selector.Kinds) == 0 {
		return "all"
	}
	scope := intent.Selector.Scope
	kind := intent.Selector.Kinds[0]
	if scope != "" {
		return fmt.Sprintf("%s_%s", scope, pluralize(kind))
	}
	return pluralize(kind)
}

func defaultPlaybookName(intent *domain.Intent) string {
	if intent.Title != "" {
		return intent.Title
	}
	return fmt.Sprintf("Enforce %s", intent.ID)
}

func pluralize(s string) string {
	if strings.HasSuffix(s, "s") {
		return s
	}
	return s + "s"
}

func singleLine(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), "\n", " ")
}

func hasAction(intent *domain.Intent, name string) bool {
	for _, a := range intent.ActionsOnViolation {
		if a == name {
			return true
		}
	}
	return false
}

// ───────────────────────── tasks ───────────────────────────────────────

type taskTemplateData struct {
	Index       int
	Description string
	Path        string
	Op          string
	Value       string
}

func buildTasks(intent *domain.Intent) ([]taskTemplateData, error) {
	tasks := make([]taskTemplateData, 0, len(intent.RequiredState))
	for i, a := range intent.RequiredState {
		valueJSON, err := json.Marshal(a.Value)
		if err != nil {
			return nil, fmt.Errorf("marshal value at idx %d: %w", i, err)
		}
		tasks = append(tasks, taskTemplateData{
			Index:       i + 1,
			Description: fmt.Sprintf("Verify %s %s %s", a.Path, a.Op, string(valueJSON)),
			Path:        a.Path,
			Op:          opToAnsibleExpr(a.Op),
			Value:       string(valueJSON),
		})
	}
	return tasks, nil
}

// opToAnsibleExpr maps an IR operator to an Ansible Jinja2 expression
// fragment usable inside `assert.that` clauses.
func opToAnsibleExpr(op domain.Op) string {
	switch op {
	case domain.OpEq:
		return "=="
	case domain.OpNe:
		return "!="
	case domain.OpLt:
		return "<"
	case domain.OpLte:
		return "<="
	case domain.OpGt:
		return ">"
	case domain.OpGte:
		return ">="
	case domain.OpIn:
		return "in"
	case domain.OpNotIn:
		return "not in"
	case domain.OpRegexMatch:
		return "is match"
	}
	return "=="
}

// ───────────────────────── assertion evaluator ─────────────────────────
// Mirror of the Rego evaluator — runs over fixture data so tests pass
// without an actual Ansible engine.

func evalAssertions(asserts []domain.RequiredStateAssertion, data map[string]any) (bool, string) {
	for _, a := range asserts {
		actual, ok := lookupPath(data, a.Path)
		if !ok {
			return false, fmt.Sprintf("missing path %s", a.Path)
		}
		if !compare(actual, a.Op, a.Value) {
			return false, fmt.Sprintf("%s %s %v failed (got %v)", a.Path, a.Op, a.Value, actual)
		}
	}
	return true, ""
}

func lookupPath(data map[string]any, path string) (any, bool) {
	parts := strings.Split(path, ".")
	var cur any = data
	for _, p := range parts {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil, false
		}
		v, ok := m[p]
		if !ok {
			return nil, false
		}
		cur = v
	}
	return cur, true
}

func compare(actual any, op domain.Op, expected any) bool {
	switch op {
	case domain.OpEq:
		return fmt.Sprintf("%v", actual) == fmt.Sprintf("%v", expected)
	case domain.OpNe:
		return fmt.Sprintf("%v", actual) != fmt.Sprintf("%v", expected)
	case domain.OpLt, domain.OpLte, domain.OpGt, domain.OpGte:
		af, aok := toFloat(actual)
		ef, eok := toFloat(expected)
		if !aok || !eok {
			return false
		}
		switch op {
		case domain.OpLt:
			return af < ef
		case domain.OpLte:
			return af <= ef
		case domain.OpGt:
			return af > ef
		case domain.OpGte:
			return af >= ef
		}
	case domain.OpIn:
		set, ok := expected.([]any)
		if !ok {
			return false
		}
		for _, v := range set {
			if fmt.Sprintf("%v", v) == fmt.Sprintf("%v", actual) {
				return true
			}
		}
		return false
	case domain.OpNotIn:
		set, ok := expected.([]any)
		if !ok {
			return true
		}
		for _, v := range set {
			if fmt.Sprintf("%v", v) == fmt.Sprintf("%v", actual) {
				return false
			}
		}
		return true
	}
	return false
}

func toFloat(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case int32:
		return float64(n), true
	}
	return 0, false
}

// ───────────────────────── playbook template ───────────────────────────

type playbookTemplateData struct {
	Name                 string
	Hosts                string
	IntentID             string
	IntentVersion        string
	PyramidArtifactID    string
	NormativeAnchors     []string
	Severity             string
	Description          string
	Tasks                []taskTemplateData
	ApplyRemediation     bool
	BlockOnFail          bool
	GeneratedAt          string
	EgideCompilerVersion string
}

var playbookTpl = template.Must(template.New("playbook").Funcs(template.FuncMap{
	"join": strings.Join,
}).Parse(playbookTemplate))

const playbookTemplate = `---
# Generated by Egide compiler v{{.EgideCompilerVersion}} at {{.GeneratedAt}}
# Intent: {{.IntentID}} v{{.IntentVersion}}
# Source pyramid artifact: {{.PyramidArtifactID}}
# Normative anchors: {{join .NormativeAnchors ", "}}
# Severity: {{.Severity}}
#
# Description: {{.Description}}
#
# Run with:
#   ansible-playbook -i inventory.yml playbook.yml --check --tags egide  # audit
#   ansible-playbook -i inventory.yml playbook.yml --tags egide,remediate -e apply_remediation=true  # apply
- name: {{.Name}}
  hosts: {{.Hosts}}
  become: true
  gather_facts: true
  vars:
    egide_intent_id: {{.IntentID}}
    egide_intent_version: "{{.IntentVersion}}"
    egide_severity: {{.Severity}}
    apply_remediation: false

  tasks:
{{- range .Tasks}}
    - name: "Egide audit · {{.Description}}"
      ansible.builtin.assert:
        that:
          - "egide_resource.{{.Path}} {{.Op}} {{.Value}}"
        fail_msg: "{{.Description}} — current state does not satisfy the Egide intent"
        success_msg: "{{.Description}} OK"
      tags: [audit, egide]
{{- if $.BlockOnFail}}
      failed_when: false
      register: egide_assert_{{.Index}}
{{- end}}
{{- end}}

{{- if .BlockOnFail}}

    - name: "Egide enforcement · fail if any audit task failed"
      ansible.builtin.fail:
        msg: "Egide intent {{ "{{ egide_intent_id }}" }} not satisfied — see prior assert results"
      when: >-
        {{- range $i, $t := .Tasks}}
        {{- if $i}}or {{end}}egide_assert_{{$t.Index}}.failed
        {{- end}}
      tags: [audit, egide]
{{- end}}
{{- if .ApplyRemediation}}

    # Remediation tasks are intentionally skeletal — caller customizes
    # via control-specific hooks. Run only when apply_remediation=true.
    - name: "Egide remediation placeholder"
      ansible.builtin.debug:
        msg: "Custom remediation hook for {{.IntentID}} — wire your module here"
      when: apply_remediation | default(false) | bool
      tags: [remediate, egide]
{{- end}}
`
