/**
 * OSCAL 1.1.x System Security Plan serializer.
 *
 * Maps an Egide pyramid graph snapshot to a minimal but valid SSP:
 *   - metadata          : title + version + last-modified
 *   - system-characteristics : derived from pyramid title + framework
 *   - system-implementation  : one component per policy
 *   - control-implementation : one implemented-requirement per anchor
 *
 * Pure function ; no I/O, no logging. Caller persists / signs.
 */

import { createHash, randomUUID } from "node:crypto";

// ── Input shapes (subset of pyramid_versions.graphSnapshot) ───────────────────

export interface PyramidPolicy {
  id?: string;
  title?: string;
  description?: string;
  /** Anchor IDs covered by this policy (e.g. ["iso27001:A.5.1"]). */
  anchor_ids?: string[];
}

export interface PyramidAnchor {
  /** Stable control identifier (e.g. "iso27001:A.5.1" or "nist:ac-1"). */
  id: string;
  title?: string;
  description?: string;
  /** Source framework (e.g. "ISO27001:2022", "NIST_800_53_rev5"). */
  framework?: string;
}

export interface PyramidSnapshot {
  framework?: string;
  anchors?: PyramidAnchor[];
  policies?: PyramidPolicy[];
  validation?: { passed?: boolean; issues?: unknown[] };
}

export interface SspExportInput {
  pyramidId: string;
  pyramidTitle: string;
  versionId: string;
  versionLabel: string; // e.g. "v3"
  contentHash: string;
  tenantId: string;
  snapshot: PyramidSnapshot;
  /** ISO 8601 timestamp ; defaults to now. */
  generatedAt?: string;
}

// ── Output shapes (OSCAL 1.1.x — minimal subset) ──────────────────────────────

interface SspMetadata {
  title: string;
  "last-modified": string;
  version: string;
  "oscal-version": string;
  remarks?: string;
}

interface SspSystemId {
  id: string;
  "identifier-type": string;
}

interface SspSystemCharacteristics {
  "system-ids": SspSystemId[];
  "system-name": string;
  description: string;
  "security-sensitivity-level": "low" | "moderate" | "high";
  "system-information": {
    "information-types": Array<{
      uuid: string;
      title: string;
      description: string;
    }>;
  };
  "security-impact-level": {
    "security-objective-confidentiality": "low" | "moderate" | "high";
    "security-objective-integrity": "low" | "moderate" | "high";
    "security-objective-availability": "low" | "moderate" | "high";
  };
  status: { state: "operational" | "under-development" | "under-major-modification" };
  "authorization-boundary": { description: string };
}

interface SspComponent {
  uuid: string;
  type: string;
  title: string;
  description: string;
  status: { state: "operational" | "disposition" | "other" };
}

interface SspImplementedRequirement {
  uuid: string;
  "control-id": string;
  remarks?: string;
  "by-components"?: Array<{
    "component-uuid": string;
    uuid: string;
    description: string;
  }>;
}

export interface SspDocument {
  "system-security-plan": {
    uuid: string;
    metadata: SspMetadata;
    "import-profile": { href: string; remarks?: string };
    "system-characteristics": SspSystemCharacteristics;
    "system-implementation": {
      users: Array<{
        uuid: string;
        title: string;
        "role-ids": string[];
      }>;
      components: SspComponent[];
    };
    "control-implementation": {
      description: string;
      "implemented-requirements": SspImplementedRequirement[];
    };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const OSCAL_VERSION = "1.1.2";

/** Deterministic UUID v5-ish from a seed string (for reproducible exports). */
function deterministicUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  // Format as UUID, set version 5 + variant bits.
  const hex = h.slice(0, 32);
  const ch13 = "5";
  const ch17Code = (Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8;
  const ch17 = ch17Code.toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `${ch13}${hex.slice(13, 16)}`,
    `${ch17}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Map an Egide framework label to a canonical OSCAL profile href.
 * Values are stable URN-style identifiers ; M5+ will publish the
 * actual catalog/profile bundles for resolution.
 */
function profileHrefFor(framework: string): string {
  const f = framework.toUpperCase();
  if (f.startsWith("ISO27001")) return "urn:egide:profile:iso27001:2022";
  if (f.startsWith("NIST_800_53")) return "urn:egide:profile:nist:800-53:rev5";
  if (f.startsWith("NIS2")) return "urn:egide:profile:eu:nis2";
  if (f.startsWith("DORA")) return "urn:egide:profile:eu:dora";
  return `urn:egide:profile:${framework.toLowerCase()}`;
}

/** Strip Egide's "framework:" prefix and lower-case for OSCAL control-id. */
function toControlId(anchorId: string): string {
  const idx = anchorId.indexOf(":");
  return (idx >= 0 ? anchorId.slice(idx + 1) : anchorId).toLowerCase();
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function serializePyramidToSSP(input: SspExportInput): SspDocument {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const framework = input.snapshot.framework ?? "ISO27001:2022";
  const policies = input.snapshot.policies ?? [];
  const anchors = input.snapshot.anchors ?? [];

  const sspUuid = deterministicUuid(`ssp:${input.pyramidId}:${input.versionId}`);
  const tenantSystemId = deterministicUuid(`system:${input.tenantId}:${input.pyramidId}`);

  // Components — one per policy (or a single placeholder if none).
  const components: SspComponent[] =
    policies.length > 0
      ? policies.map((p, i) => ({
          uuid: deterministicUuid(`component:${input.pyramidId}:${p.id ?? i}`),
          type: "policy",
          title: p.title ?? `Policy ${i + 1}`,
          description: p.description ?? "Generated from Egide pyramid.",
          status: { state: "operational" },
        }))
      : [
          {
            uuid: deterministicUuid(`component:${input.pyramidId}:default`),
            type: "policy",
            title: "Egide pyramid (no policies)",
            description: "Pyramid has no draft policies yet.",
            status: { state: "other" },
          },
        ];

  // Index components by policy id for cross-ref.
  const componentByPolicyId = new Map<string, string>();
  policies.forEach((p, i) => {
    if (p.id) componentByPolicyId.set(p.id, components[i]?.uuid ?? "");
  });

  // Implemented requirements — one per anchor.
  const implementedRequirements: SspImplementedRequirement[] = anchors.map(
    (a) => {
      const linkedComponents = policies
        .filter((p) => p.anchor_ids?.includes(a.id))
        .map((p) => p.id)
        .filter((id): id is string => Boolean(id))
        .map((id) => componentByPolicyId.get(id))
        .filter((u): u is string => Boolean(u));

      const byComponents =
        linkedComponents.length > 0
          ? linkedComponents.map((cu) => ({
              "component-uuid": cu,
              uuid: deterministicUuid(`bycomp:${a.id}:${cu}`),
              description: a.description ?? `Anchor ${a.id}`,
            }))
          : undefined;

      return {
        uuid: deterministicUuid(`req:${input.pyramidId}:${a.id}`),
        "control-id": toControlId(a.id),
        remarks: a.title,
        ...(byComponents ? { "by-components": byComponents } : {}),
      };
    },
  );

  return {
    "system-security-plan": {
      uuid: sspUuid,
      metadata: {
        title: `${input.pyramidTitle} — System Security Plan`,
        "last-modified": generatedAt,
        version: input.versionLabel,
        "oscal-version": OSCAL_VERSION,
        remarks: `Generated by Egide. content_hash=${input.contentHash}`,
      },
      "import-profile": {
        href: profileHrefFor(framework),
        remarks: `Framework: ${framework}`,
      },
      "system-characteristics": {
        "system-ids": [
          { id: tenantSystemId, "identifier-type": "https://egide.eu/oscal/system-id" },
        ],
        "system-name": input.pyramidTitle,
        description: `System governed by Egide pyramid ${input.pyramidId}.`,
        "security-sensitivity-level": "moderate",
        "system-information": {
          "information-types": [
            {
              uuid: deterministicUuid(`info:${input.pyramidId}`),
              title: "Operational data",
              description:
                "Information processed by the system in scope of this pyramid.",
            },
          ],
        },
        "security-impact-level": {
          "security-objective-confidentiality": "moderate",
          "security-objective-integrity": "moderate",
          "security-objective-availability": "moderate",
        },
        status: { state: "operational" },
        "authorization-boundary": {
          description: `Boundary defined by tenant ${input.tenantId}.`,
        },
      },
      "system-implementation": {
        users: [
          {
            uuid: deterministicUuid(`user:${input.tenantId}:owner`),
            title: "System owner",
            "role-ids": ["system-owner"],
          },
        ],
        components,
      },
      "control-implementation": {
        description: `Implementation derived from ${policies.length} polic(y|ies) covering ${anchors.length} anchor(s).`,
        "implemented-requirements": implementedRequirements,
      },
    },
  };
}

// Avoid TS unused-import warning when `randomUUID` isn't reached.
void randomUUID;
