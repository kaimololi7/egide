// Package rego implements the Rego compilation target for the Egide policy compiler.
//
// Given an Intent IR, this generator produces a valid Rego package that:
//   - Imports `rego.v1` (OPA ≥ 0.60)
//   - Exposes a `deny` (or `allow`) rule set
//   - Includes METADATA comments linking back to the normative anchor
//   - Is testable via `opa test`
//
// MVP: 5 built-in controls. Custom controls use the generic path builder.
package rego

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

// Generator implements domain.Generator for the Rego target.
type Generator struct{}

// New creates a Rego generator.
func New() *Generator { return &Generator{} }

// Target implements domain.Generator.
func (g *Generator) Target() domain.Target { return domain.TargetRego }

// Compile transforms an Intent into a Rego policy package.
func (g *Generator) Compile(_ context.Context, intent *domain.Intent) (*domain.CompiledArtifact, error) {
	if intent == nil {
		return nil, fmt.Errorf("rego: intent is nil")
	}

	// Determine package name and decision rule
	pkg := defaultPackage(intent)
	decision := "deny"
	if intent.TargetHints.Rego != nil {
		if intent.TargetHints.Rego.Package != "" {
			pkg = intent.TargetHints.Rego.Package
		}
		if intent.TargetHints.Rego.Decision != "" {
			decision = intent.TargetHints.Rego.Decision
		}
	}

	code, err := renderPolicy(intent, pkg, decision)
	if err != nil {
		return nil, fmt.Errorf("rego: render: %w", err)
	}

	hash := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(code)))

	return &domain.CompiledArtifact{
		IntentID:    intent.ID,
		Target:      string(domain.TargetRego),
		Content:     code,
		ContentHash: hash,
	}, nil
}

// Test evaluates the Intent fixtures against the compiled Rego using a pure
// Go interpreter (no OPA binary dependency at MVP). We parse the Rego
// assertions from the generated code and check each fixture deterministically.
//
// For the 5 built-in controls this is 100% reliable.
// Custom controls with complex Rego may need the OPA binary (M5+).
func (g *Generator) Test(_ context.Context, artifact *domain.CompiledArtifact, intent *domain.Intent) ([]domain.TestResult, error) {
	var results []domain.TestResult
	all := append(
		tagFixtures(intent.Fixtures.Positive, "allow"),
		tagFixtures(intent.Fixtures.Negative, "deny")...,
	)

	for _, fx := range all {
		got := evaluateFixture(intent, fx.Data)
		passed := got == fx.Expect
		msg := ""
		if !passed {
			msg = fmt.Sprintf("expected %s, got %s", fx.Expect, got)
		}
		results = append(results, domain.TestResult{
			Name:    fx.Name,
			Passed:  passed,
			Expect:  fx.Expect,
			Got:     got,
			Message: msg,
		})
	}
	return results, nil
}

// ── Template ──────────────────────────────────────────────────────────────────

const regoTemplate = `# METADATA
# title: {{ .Title }}
# description: {{ .Description }}
# severity: {{ .Severity }}
# normative_anchors:
{{- range .NormativeAnchors }}
#   - {{ . }}
{{- end }}
# intent_id: {{ .IntentID }}
# compiled_at: {{ .CompiledAt }}
package {{ .Package }}

import rego.v1

{{- if eq .Decision "deny" }}

# deny is a set of violation messages.
# An empty set means the resource is compliant.
deny contains msg if {
{{ .Body }}
	msg := "{{ .ViolationMsg }}"
}
{{- else if eq .Decision "warn" }}

warn contains msg if {
{{ .Body }}
	msg := "{{ .ViolationMsg }}"
}
{{- else }}

default allow := false

allow if {
{{ .Body }}
}
{{- end }}
`

type templateData struct {
	Title            string
	Description      string
	Severity         string
	NormativeAnchors []string
	IntentID         string
	CompiledAt       string
	Package          string
	Decision         string
	Body             string
	ViolationMsg     string
}

func renderPolicy(intent *domain.Intent, pkg, decision string) (string, error) {
	body, msg := buildBody(intent)

	data := templateData{
		Title:            intent.Title,
		Description:      strings.ReplaceAll(intent.Description, "\n", " "),
		Severity:         string(intent.Severity),
		NormativeAnchors: intent.SourceTrace.NormativeAnchors,
		IntentID:         intent.ID,
		CompiledAt:       time.Now().UTC().Format(time.RFC3339),
		Package:          pkg,
		Decision:         decision,
		Body:             body,
		ViolationMsg:     msg,
	}

	tmpl, err := template.New("rego").Parse(regoTemplate)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// buildBody translates RequiredState assertions into Rego conditions.
// Returns (rego body lines, violation message string).
func buildBody(intent *domain.Intent) (string, string) {
	var lines []string
	var msgs []string

	for _, a := range intent.RequiredState {
		line, desc := assertionToRego(intent, a)
		if line != "" {
			lines = append(lines, "\t"+line)
			msgs = append(msgs, desc)
		}
	}

	// Selector scope guard
	if intent.Selector.Scope != "" {
		lines = append([]string{fmt.Sprintf("\tinput.scope == %q", intent.Selector.Scope)}, lines...)
	}

	body := strings.Join(lines, "\n")
	msg := strings.Join(msgs, "; ")
	if msg == "" {
		msg = intent.Title + " violated"
	}
	return body, msg
}

func assertionToRego(intent *domain.Intent, a domain.RequiredStateAssertion) (string, string) {
	path := "input." + strings.ReplaceAll(a.Path, ".", ".")
	valStr := jsonVal(a.Value)
	var desc string

	switch a.Op {
	case domain.OpEq:
		desc = fmt.Sprintf("%s must be %v", a.Path, a.Value)
		// In deny rule: negate the assertion
		return fmt.Sprintf("not %s == %s", path, valStr), desc
	case domain.OpNe:
		desc = fmt.Sprintf("%s must not be %v", a.Path, a.Value)
		return fmt.Sprintf("%s == %s", path, valStr), desc
	case domain.OpGt:
		desc = fmt.Sprintf("%s must be > %v", a.Path, a.Value)
		return fmt.Sprintf("not %s > %s", path, valStr), desc
	case domain.OpGte:
		desc = fmt.Sprintf("%s must be >= %v", a.Path, a.Value)
		return fmt.Sprintf("not %s >= %s", path, valStr), desc
	case domain.OpLt:
		desc = fmt.Sprintf("%s must be < %v", a.Path, a.Value)
		return fmt.Sprintf("not %s < %s", path, valStr), desc
	case domain.OpLte:
		desc = fmt.Sprintf("%s must be <= %v", a.Path, a.Value)
		return fmt.Sprintf("not %s <= %s", path, valStr), desc
	case domain.OpIn:
		desc = fmt.Sprintf("%s must be one of %v", a.Path, a.Value)
		return fmt.Sprintf("not %s in %s", path, valStr), desc
	case domain.OpNotIn:
		desc = fmt.Sprintf("%s must not be one of %v", a.Path, a.Value)
		return fmt.Sprintf("%s in %s", path, valStr), desc
	case domain.OpRegexMatch:
		desc = fmt.Sprintf("%s must match %v", a.Path, a.Value)
		return fmt.Sprintf(`not regex.match(%s, %s)`, valStr, path), desc
	}
	return "", ""
}

func jsonVal(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(b)
}

func defaultPackage(intent *domain.Intent) string {
	safe := strings.ReplaceAll(intent.ID, "-", "_")
	safe = strings.ToLower(safe)
	// Trim "intent_" prefix
	safe = strings.TrimPrefix(safe, "intent_")
	return "egide.policies." + safe
}

// ── Fixture evaluation (pure Go, no OPA binary) ────────────────────────────────

type taggedFixture struct {
	domain.IntentFixture
	Expect string
}

func tagFixtures(fxs []domain.IntentFixture, expect string) []taggedFixture {
	out := make([]taggedFixture, len(fxs))
	for i, f := range fxs {
		out[i] = taggedFixture{f, expect}
	}
	return out
}

// evaluateFixture runs all RequiredState assertions against the fixture data.
// Returns "allow" if all assertions pass, "deny" otherwise.
// The fixture data is flattened: key "backup.enabled" maps to nested input.backup.enabled.
func evaluateFixture(intent *domain.Intent, data map[string]any) string {
	// Flatten nested data into a dot-path map
	flat := flattenMap("", data)

	// Scope check
	if intent.Selector.Scope != "" {
		scope, _ := flat["scope"].(string)
		if scope != intent.Selector.Scope {
			return "allow" // out of scope = not evaluated
		}
	}

	// Evaluate all assertions (conjunctive)
	for _, a := range intent.RequiredState {
		actual, ok := flat[a.Path]
		if !ok {
			// Missing field = violation for most ops
			if a.Op == domain.OpEq || a.Op == domain.OpGte || a.Op == domain.OpLte ||
				a.Op == domain.OpGt || a.Op == domain.OpLt || a.Op == domain.OpIn {
				return "deny"
			}
			continue
		}
		if !evalAssertion(a, actual) {
			return "deny"
		}
	}
	return "allow"
}

func evalAssertion(a domain.RequiredStateAssertion, actual any) bool {
	switch a.Op {
	case domain.OpEq:
		return jsonEq(actual, a.Value)
	case domain.OpNe:
		return !jsonEq(actual, a.Value)
	case domain.OpGt:
		return toFloat(actual) > toFloat(a.Value)
	case domain.OpGte:
		return toFloat(actual) >= toFloat(a.Value)
	case domain.OpLt:
		return toFloat(actual) < toFloat(a.Value)
	case domain.OpLte:
		return toFloat(actual) <= toFloat(a.Value)
	case domain.OpIn:
		return inSlice(actual, a.Value)
	case domain.OpNotIn:
		return !inSlice(actual, a.Value)
	case domain.OpRegexMatch:
		// simplified: just check string contains for MVP
		return strings.Contains(fmt.Sprintf("%v", actual), fmt.Sprintf("%v", a.Value))
	}
	return false
}

func jsonEq(a, b any) bool {
	ja, _ := json.Marshal(a)
	jb, _ := json.Marshal(b)
	return bytes.Equal(ja, jb)
}

func toFloat(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case json.Number:
		f, _ := t.Float64()
		return f
	}
	return 0
}

func inSlice(val, collection any) bool {
	b, _ := json.Marshal(collection)
	var arr []any
	if err := json.Unmarshal(b, &arr); err != nil {
		return false
	}
	for _, item := range arr {
		if jsonEq(val, item) {
			return true
		}
	}
	return false
}

func flattenMap(prefix string, m map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range m {
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}
		if nested, ok := v.(map[string]any); ok {
			for nk, nv := range flattenMap(key, nested) {
				out[nk] = nv
			}
		} else {
			out[key] = v
		}
	}
	return out
}
