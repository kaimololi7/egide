// Package controls contains the 5 built-in Intent IR definitions for MVP.
//
// Controls:
//
//	C01 — DB backup required (ISO27001:2022 A.8.13)
//	C02 — Encryption at rest (ISO27001:2022 A.8.24 / NIS2 Art.21.2.h)
//	C03 — Access logging (ISO27001:2022 A.8.15 / NIS2 Art.21.2.i)
//	C04 — MFA enforcement (ISO27001:2022 A.8.5 / NIS2 Art.21.2.j)
//	C05 — Network egress restriction (ISO27001:2022 A.8.20 / NIS2 Art.21.2.e)
package controls

import (
	"time"

	"github.com/egide/egide/services/compiler/internal/domain"
)

var now = time.Date(2026, 5, 5, 0, 0, 0, 0, time.UTC)

// All returns all built-in Intent definitions.
func All() []*domain.Intent {
	return []*domain.Intent{
		C01DBBackupRequired(),
		C02EncryptionAtRest(),
		C03AccessLogging(),
		C04MFAEnforcement(),
		C05NetworkEgressRestriction(),
	}
}

// ByID returns a built-in Intent by ID, or nil.
func ByID(id string) *domain.Intent {
	for _, c := range All() {
		if c.ID == id {
			return c
		}
	}
	return nil
}

// ── C01 — DB Backup ──────────────────────────────────────────────────────────

func C01DBBackupRequired() *domain.Intent {
	return &domain.Intent{
		ID:          "intent_db_backup_required",
		Version:     "1.0.0",
		Title:       "Production databases must have backup enabled",
		Description: "Every database in production scope must have backup enabled with a frequency <= 24h and retention >= 30 days.",
		Selector: domain.Selector{
			Kinds: []string{"database"},
			Scope: "production",
		},
		RequiredState: []domain.RequiredStateAssertion{
			{Path: "backup.enabled", Op: domain.OpEq, Value: true},
			{Path: "backup.frequency_hours", Op: domain.OpLte, Value: 24.0},
			{Path: "backup.retention_days", Op: domain.OpGte, Value: 30.0},
		},
		ActionsOnViolation: []string{"audit", "block_deployment", "notify_owner"},
		Severity:           domain.SeverityError,
		SourceTrace: domain.SourceTrace{
			PyramidArtifactID: "policy_data_protection",
			NormativeAnchors:  []string{"iso27001-2022:A.8.13", "nis2:Art.21.2.c"},
		},
		TargetHints: domain.TargetHints{
			Rego: &domain.RegoHints{Package: "egide.policies.db.backup", Decision: "deny"},
		},
		Fixtures: domain.IntentFixtures{
			Positive: []domain.IntentFixture{
				{
					Name:   "compliant — daily backup 60d retention",
					Data:   map[string]any{"scope": "production", "backup": map[string]any{"enabled": true, "frequency_hours": 24.0, "retention_days": 60.0}},
					Expect: "allow",
				},
				{
					Name:   "compliant — hourly backup 90d retention",
					Data:   map[string]any{"scope": "production", "backup": map[string]any{"enabled": true, "frequency_hours": 1.0, "retention_days": 90.0}},
					Expect: "allow",
				},
			},
			Negative: []domain.IntentFixture{
				{
					Name:   "violation — backup disabled",
					Data:   map[string]any{"scope": "production", "backup": map[string]any{"enabled": false, "frequency_hours": 24.0, "retention_days": 60.0}},
					Expect: "deny",
				},
				{
					Name:   "violation — weekly backup",
					Data:   map[string]any{"scope": "production", "backup": map[string]any{"enabled": true, "frequency_hours": 168.0, "retention_days": 60.0}},
					Expect: "deny",
				},
				{
					Name:   "violation — insufficient retention",
					Data:   map[string]any{"scope": "production", "backup": map[string]any{"enabled": true, "frequency_hours": 24.0, "retention_days": 7.0}},
					Expect: "deny",
				},
			},
		},
		Metadata: domain.IntentMetadata{CreatedAt: now, UpdatedAt: now},
	}
}

// ── C02 — Encryption at rest ─────────────────────────────────────────────────

func C02EncryptionAtRest() *domain.Intent {
	return &domain.Intent{
		ID:          "intent_encryption_at_rest",
		Version:     "1.0.0",
		Title:       "Storage resources must have encryption at rest enabled",
		Description: "All persistent storage in production must have encryption enabled with an approved algorithm (AES-256 or ChaCha20-Poly1305).",
		Selector: domain.Selector{
			Kinds: []string{"storage", "database", "volume"},
			Scope: "production",
		},
		RequiredState: []domain.RequiredStateAssertion{
			{Path: "encryption.at_rest", Op: domain.OpEq, Value: true},
			{Path: "encryption.algorithm", Op: domain.OpIn, Value: []any{"AES-256", "ChaCha20-Poly1305"}},
		},
		ActionsOnViolation: []string{"block_deployment", "notify_owner"},
		Severity:           domain.SeverityError,
		SourceTrace: domain.SourceTrace{
			PyramidArtifactID: "policy_data_protection",
			NormativeAnchors:  []string{"iso27001-2022:A.8.24", "nis2:Art.21.2.h"},
		},
		TargetHints: domain.TargetHints{
			Rego: &domain.RegoHints{Package: "egide.policies.storage.encryption", Decision: "deny"},
		},
		Fixtures: domain.IntentFixtures{
			Positive: []domain.IntentFixture{
				{
					Name:   "compliant — AES-256",
					Data:   map[string]any{"scope": "production", "encryption": map[string]any{"at_rest": true, "algorithm": "AES-256"}},
					Expect: "allow",
				},
				{
					Name:   "compliant — ChaCha20",
					Data:   map[string]any{"scope": "production", "encryption": map[string]any{"at_rest": true, "algorithm": "ChaCha20-Poly1305"}},
					Expect: "allow",
				},
			},
			Negative: []domain.IntentFixture{
				{
					Name:   "violation — no encryption",
					Data:   map[string]any{"scope": "production", "encryption": map[string]any{"at_rest": false}},
					Expect: "deny",
				},
				{
					Name:   "violation — weak algorithm",
					Data:   map[string]any{"scope": "production", "encryption": map[string]any{"at_rest": true, "algorithm": "AES-128"}},
					Expect: "deny",
				},
			},
		},
		Metadata: domain.IntentMetadata{CreatedAt: now, UpdatedAt: now},
	}
}

// ── C03 — Access logging ─────────────────────────────────────────────────────

func C03AccessLogging() *domain.Intent {
	return &domain.Intent{
		ID:          "intent_access_logging",
		Version:     "1.0.0",
		Title:       "Services must have access logging enabled",
		Description: "All production services must enable access logging with a retention of at least 90 days.",
		Selector: domain.Selector{
			Kinds: []string{"service", "api", "database", "storage"},
			Scope: "production",
		},
		RequiredState: []domain.RequiredStateAssertion{
			{Path: "logging.access_enabled", Op: domain.OpEq, Value: true},
			{Path: "logging.retention_days", Op: domain.OpGte, Value: 90.0},
		},
		ActionsOnViolation: []string{"audit", "notify_owner"},
		Severity:           domain.SeverityWarning,
		SourceTrace: domain.SourceTrace{
			PyramidArtifactID: "policy_monitoring",
			NormativeAnchors:  []string{"iso27001-2022:A.8.15", "nis2:Art.21.2.i"},
		},
		TargetHints: domain.TargetHints{
			Rego: &domain.RegoHints{Package: "egide.policies.logging.access", Decision: "warn"},
		},
		Fixtures: domain.IntentFixtures{
			Positive: []domain.IntentFixture{
				{
					Name:   "compliant — logging on, 365d retention",
					Data:   map[string]any{"scope": "production", "logging": map[string]any{"access_enabled": true, "retention_days": 365.0}},
					Expect: "allow",
				},
			},
			Negative: []domain.IntentFixture{
				{
					Name:   "violation — logging disabled",
					Data:   map[string]any{"scope": "production", "logging": map[string]any{"access_enabled": false, "retention_days": 365.0}},
					Expect: "deny",
				},
				{
					Name:   "violation — short retention",
					Data:   map[string]any{"scope": "production", "logging": map[string]any{"access_enabled": true, "retention_days": 30.0}},
					Expect: "deny",
				},
			},
		},
		Metadata: domain.IntentMetadata{CreatedAt: now, UpdatedAt: now},
	}
}

// ── C04 — MFA enforcement ────────────────────────────────────────────────────

func C04MFAEnforcement() *domain.Intent {
	return &domain.Intent{
		ID:          "intent_mfa_enforcement",
		Version:     "1.0.0",
		Title:       "IAM users must have MFA enabled",
		Description: "Every IAM user with console or API access must have multi-factor authentication enabled.",
		Selector: domain.Selector{
			Kinds: []string{"iam_user", "user"},
		},
		RequiredState: []domain.RequiredStateAssertion{
			{Path: "mfa.enabled", Op: domain.OpEq, Value: true},
			{Path: "mfa.method", Op: domain.OpIn, Value: []any{"totp", "hardware_key", "passkey"}},
		},
		ActionsOnViolation: []string{"block_deployment", "notify_owner"},
		Severity:           domain.SeverityError,
		SourceTrace: domain.SourceTrace{
			PyramidArtifactID: "policy_access_control",
			NormativeAnchors:  []string{"iso27001-2022:A.8.5", "nis2:Art.21.2.j"},
		},
		TargetHints: domain.TargetHints{
			Rego: &domain.RegoHints{Package: "egide.policies.iam.mfa", Decision: "deny"},
		},
		Fixtures: domain.IntentFixtures{
			Positive: []domain.IntentFixture{
				{
					Name:   "compliant — TOTP",
					Data:   map[string]any{"mfa": map[string]any{"enabled": true, "method": "totp"}},
					Expect: "allow",
				},
				{
					Name:   "compliant — hardware key",
					Data:   map[string]any{"mfa": map[string]any{"enabled": true, "method": "hardware_key"}},
					Expect: "allow",
				},
			},
			Negative: []domain.IntentFixture{
				{
					Name:   "violation — no MFA",
					Data:   map[string]any{"mfa": map[string]any{"enabled": false}},
					Expect: "deny",
				},
				{
					Name:   "violation — SMS MFA (not approved)",
					Data:   map[string]any{"mfa": map[string]any{"enabled": true, "method": "sms"}},
					Expect: "deny",
				},
			},
		},
		Metadata: domain.IntentMetadata{CreatedAt: now, UpdatedAt: now},
	}
}

// ── C05 — Network egress restriction ─────────────────────────────────────────

func C05NetworkEgressRestriction() *domain.Intent {
	return &domain.Intent{
		ID:          "intent_network_egress_restriction",
		Version:     "1.0.0",
		Title:       "Network egress must be restricted to approved CIDRs",
		Description: "Production network interfaces must have egress rules defined and restricted to an approved CIDR list.",
		Selector: domain.Selector{
			Kinds: []string{"network_interface", "security_group"},
			Scope: "production",
		},
		RequiredState: []domain.RequiredStateAssertion{
			{Path: "egress.restricted", Op: domain.OpEq, Value: true},
			{Path: "egress.rules_defined", Op: domain.OpEq, Value: true},
		},
		ActionsOnViolation: []string{"block_deployment", "notify_owner"},
		Severity:           domain.SeverityError,
		SourceTrace: domain.SourceTrace{
			PyramidArtifactID: "policy_network_security",
			NormativeAnchors:  []string{"iso27001-2022:A.8.20", "nis2:Art.21.2.e"},
		},
		TargetHints: domain.TargetHints{
			Rego: &domain.RegoHints{Package: "egide.policies.network.egress", Decision: "deny"},
		},
		Fixtures: domain.IntentFixtures{
			Positive: []domain.IntentFixture{
				{
					Name:   "compliant — restricted with rules",
					Data:   map[string]any{"scope": "production", "egress": map[string]any{"restricted": true, "rules_defined": true}},
					Expect: "allow",
				},
			},
			Negative: []domain.IntentFixture{
				{
					Name:   "violation — no restriction",
					Data:   map[string]any{"scope": "production", "egress": map[string]any{"restricted": false, "rules_defined": true}},
					Expect: "deny",
				},
				{
					Name:   "violation — no rules",
					Data:   map[string]any{"scope": "production", "egress": map[string]any{"restricted": true, "rules_defined": false}},
					Expect: "deny",
				},
			},
		},
		Metadata: domain.IntentMetadata{CreatedAt: now, UpdatedAt: now},
	}
}
