package ansible

import (
	"strings"
	"testing"
)

func TestEmitMoleculeScenario_Files(t *testing.T) {
	t.Parallel()
	intent := sampleIntent()
	s, err := EmitMoleculeScenario(intent, "playbook.yml")
	if err != nil {
		t.Fatalf("EmitMoleculeScenario: %v", err)
	}
	expected := []string{
		"molecule/default/molecule.yml",
		"molecule/default/converge.yml",
		"molecule/default/verify.yml",
		"molecule/default/prepare.yml",
	}
	for _, p := range expected {
		if _, ok := s.Files[p]; !ok {
			t.Errorf("expected file %s in scenario", p)
		}
	}
}

func TestEmitMoleculeScenario_NilIntent(t *testing.T) {
	t.Parallel()
	if _, err := EmitMoleculeScenario(nil, ""); err == nil {
		t.Fatal("expected error for nil intent")
	}
}

func TestEmitMoleculeScenario_ContentSanity(t *testing.T) {
	t.Parallel()
	s, err := EmitMoleculeScenario(sampleIntent(), "playbook.yml")
	if err != nil {
		t.Fatal(err)
	}
	mol := s.Files["molecule/default/molecule.yml"]
	must := []string{
		"driver:",
		"name: docker",
		"egide-positive",
		"egide-negative",
		"verifier:",
	}
	for _, w := range must {
		if !strings.Contains(mol, w) {
			t.Errorf("molecule.yml missing %q", w)
		}
	}
	prep := s.Files["molecule/default/prepare.yml"]
	if !strings.Contains(prep, "egide_resource") {
		t.Error("prepare.yml must seed egide_resource fact")
	}
	conv := s.Files["molecule/default/converge.yml"]
	if !strings.Contains(conv, "playbook.yml") {
		t.Error("converge.yml must reference the generated playbook")
	}
}
