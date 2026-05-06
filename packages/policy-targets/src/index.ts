/**
 * @egide/policy-targets — multi-target policy compilation adapters.
 *
 * MVP: Rego only (cf. ADR 005 amendment 2026-05-05).
 * Roadmap: Ansible (M6), CIS (M7), Kyverno (M10), cloud (M13+).
 *
 * Status: scaffold. Real adapters live in services/compiler.
 */

export const TARGETS = ["rego"] as const;
export type Target = (typeof TARGETS)[number];
