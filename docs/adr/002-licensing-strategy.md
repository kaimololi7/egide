# ADR 002 — Licensing strategy: AGPL-3.0 + Commercial dual licensing

- **Status**: Accepted
- **Date**: 2026-05-04
- **Deciders**: solo founder

## Context

Egide is open-core. We must choose:

1. A **community license** that allows free self-hosting and contributions but
   prevents extraction by hyperscalers or competitors who could rebrand and
   re-host the product without giving back.
2. A **commercial license** for tenants who cannot or will not comply with
   the community terms.

Reference points from peers:

- **CISO Assistant** (intuitem, FR): AGPL-3.0-only. 3.6k stars, healthy community.
  Confirms AGPL is acceptable to this market.
- **MongoDB**: relicensed from AGPL to SSPL after AWS exploitation. SSPL is not
  OSI-approved and creates friction with distros (Debian dropped them).
- **Elastic**: dual-licensed Elastic v2 + SSPL after AWS exploitation. Lost
  significant goodwill. Eventually re-added AGPL option.
- **Sentry**: BSL (Business Source License) with time-delayed conversion to
  Apache. Restrictive but considered fair by community.
- **Grafana, GitLab**: Apache or MIT for core, separate paid edition. Works
  because the moat is in the paid tier, not in the community code.

## Decision

### Community: GNU AGPL-3.0-only

Selected because:

- **Network-use clause (§13)** forces any party offering Egide as a SaaS to
  publish their modifications. This blocks the AWS / Vanta-style fork that
  would commoditize Egide without contributing back.
- **OSI-approved**, FSF-approved, distro-friendly. No license-friction surprises.
- **Strong precedent in EU GRC** (CISO Assistant ships AGPL and grew to 3.6k
  stars, proving AGPL does not block adoption in this segment).
- **Compatible with our target market** — RSSI/DSI of regulated EU orgs are
  used to GPL-family licenses (Linux, Postgres, Ansible).

We choose AGPL-3.0-**only** (not "or-later") to retain control of license
upgrades. If FSF publishes AGPL-4.0 we will evaluate consciously.

### Commercial: Egide Professional and Enterprise

Customers who cannot accept AGPL terms (typically: integrators wanting closed
SaaS, embedders shipping proprietary products, organizations needing
contractual indemnification) sign a Commercial License Agreement (CLA).

The Commercial license also unlocks **Edition-gated features**:

- Multi-tenant orchestration
- Air-gapped bundle (Proxmox image, offline-update channel)
- Advanced policy targets (Kyverno, CEL, AWS Config, Falco)
- White-label MSSP mode
- SSO / SAML / SCIM
- 24/7 SLA, indemnification
- Signed OSCAL exports with hash chaining
- Strategic→executable cascade with board signature workflow (J6)

See `docs/editions.md` for the full matrix.

### Contributor License Agreement (CLA)

External contributions (when public) require a **Developer Certificate of
Origin (DCO)** — `Signed-off-by` on each commit. We do **not** require a CLA
that transfers copyright; this is a deliberate choice to preserve community trust.

If we ever need to relicense (e.g., add SSPL alongside AGPL), we will open a
**community RFC** rather than rely on a CLA carve-out. This sets us apart from
MongoDB / Elastic and signals long-term good faith.

### Edition gating mechanism

- Single repository contains **all** code, AGPL and commercial both.
- Commercial features are gated at runtime by:
  - `EGIDE_EDITION` env (`community` | `professional` | `enterprise`)
  - Signed license key verification (Ed25519 against an embedded public key)
- AGPL users running with `EGIDE_EDITION=enterprise` without a valid license
  will see the feature but get a **clear error message** explaining commercial
  terms.
- License verification code is itself AGPL-licensed; "removing the check" by
  forking is technically possible but legally a license violation (and our
  open-source license already grants free Community use, removing motivation
  for paying users to do this).

## Consequences

- Marketing positioning: "open core, sovereign, AGPL". We can publish on
  Show HN, Reddit /r/sysadmin, /r/cybersecurity and expect fair reception.
- Sales positioning: "Need closed-SaaS embedding, multi-tenant, air-gapped, or
  SLA? You sign a commercial license."
- Founder must draft a Commercial License Agreement with legal counsel before
  the first paid customer signs (estimated cost: 2–5K€ legal fees).
- Trademark "Egide" should be registered in EU before public release to
  prevent name squatting and protect brand for commercial track.
- All code files include the standard AGPL-3.0 header on creation.

## Open questions

- Do we offer a **time-limited evaluation license** for Enterprise features
  (e.g., 30-day free trial)? Probably yes; defer the call to first sales conversation.
- Do we publish a **Community Plus** intermediate tier (free but commercial)
  for non-profits and academic use? Defer to community feedback post-launch.
