package rego_test

import (
	"context"
	"strings"
	"testing"

	"github.com/egide/egide/services/compiler/internal/generators/rego"
	"github.com/egide/egide/services/compiler/internal/generators/rego/controls"
)

func TestCompile_AllControls(t *testing.T) {
	gen := rego.New()
	ctx := context.Background()

	for _, intent := range controls.All() {
		t.Run(intent.ID, func(t *testing.T) {
			artifact, err := gen.Compile(ctx, intent)
			if err != nil {
				t.Fatalf("Compile failed: %v", err)
			}
			if artifact == nil {
				t.Fatal("artifact is nil")
			}
			if artifact.Content == "" {
				t.Error("artifact content is empty")
			}
			if !strings.HasPrefix(artifact.ContentHash, "sha256:") {
				t.Errorf("expected sha256: prefix, got %s", artifact.ContentHash)
			}
			if !strings.Contains(artifact.Content, "import rego.v1") {
				t.Error("missing 'import rego.v1' in generated Rego")
			}
			if !strings.Contains(artifact.Content, "package") {
				t.Error("missing package declaration in generated Rego")
			}
		})
	}
}

func TestTest_AllControlsFixtures(t *testing.T) {
	gen := rego.New()
	ctx := context.Background()

	for _, intent := range controls.All() {
		t.Run(intent.ID, func(t *testing.T) {
			artifact, err := gen.Compile(ctx, intent)
			if err != nil {
				t.Fatalf("Compile failed: %v", err)
			}

			results, err := gen.Test(ctx, artifact, intent)
			if err != nil {
				t.Fatalf("Test failed: %v", err)
			}

			passed := 0
			for _, r := range results {
				if r.Passed {
					passed++
				} else {
					t.Errorf("fixture %q: expected %s, got %s — %s", r.Name, r.Expect, r.Got, r.Message)
				}
			}
			t.Logf("%s: %d/%d fixtures passed", intent.ID, passed, len(results))
		})
	}
}

func TestCompile_NilIntent(t *testing.T) {
	gen := rego.New()
	_, err := gen.Compile(context.Background(), nil)
	if err == nil {
		t.Error("expected error for nil intent")
	}
}

func TestCompile_CustomTargetHints(t *testing.T) {
	intent := controls.C01DBBackupRequired()
	intent.TargetHints.Rego.Package = "custom.package.db"
	intent.TargetHints.Rego.Decision = "allow"

	gen := rego.New()
	artifact, err := gen.Compile(context.Background(), intent)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(artifact.Content, "package custom.package.db") {
		t.Error("custom package not applied")
	}
	if !strings.Contains(artifact.Content, "default allow := false") {
		t.Error("allow decision not applied")
	}
}
