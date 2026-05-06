/**
 * Edition gating (cf. ADR 002 + docs/editions.md).
 *
 * Maps feature keys to the minimum edition required. Used by the
 * router to refuse provider configurations not allowed in the
 * tenant's edition.
 */

import type { Edition } from "./types.js";

const EDITION_RANK: Record<Edition, number> = {
  community: 0,
  professional: 1,
  enterprise: 2,
};

export const FEATURE_REQUIREMENTS: Record<string, Edition> = {
  // Cloud sovereign EU providers — Pro+
  "llm.scaleway": "professional",
  "llm.ovh": "professional",

  // Per-task routing config — Pro+
  "llm.route_per_task": "professional",
  "llm.budget_caps": "professional",

  // Bundled local LLM in install image — Enterprise
  "llm.bundled_local": "enterprise",

  // Compiler targets
  "compiler.kyverno": "professional",
  "compiler.cis": "professional",
  "compiler.aws_config": "professional",
  "compiler.azure_policy": "professional",
  "compiler.scaleway_iam": "professional",
  "compiler.gcp_org_policy": "professional",
  "compiler.falco": "professional",
  "compiler.cf_guard": "enterprise",
  "compiler.custom_plugins": "enterprise",

  // Audit
  "audit.signed_snapshots": "professional",
  "audit.oscal_signed_chain": "enterprise",

  // Governance
  "directive.signature_workflow": "enterprise",

  // Deploy
  "deploy.air_gapped": "enterprise",

  // Multi-tenant
  "tenant.multi": "professional",
  "tenant.unlimited": "enterprise",

  // Auth
  "auth.saml_oidc": "enterprise",
  "auth.scim": "enterprise",
};

export function compareEditions(a: Edition, b: Edition): number {
  return EDITION_RANK[a] - EDITION_RANK[b];
}

export function editionAllows(edition: Edition, feature: string): boolean {
  const required = FEATURE_REQUIREMENTS[feature];
  if (!required) return true; // unknown feature → not gated
  return compareEditions(edition, required) >= 0;
}

export class EditionUpgradeRequired extends Error {
  constructor(
    public readonly feature: string,
    public readonly required: Edition,
  ) {
    super(
      `Feature "${feature}" requires edition "${required}". See docs/editions.md.`,
    );
    this.name = "EditionUpgradeRequired";
  }
}
