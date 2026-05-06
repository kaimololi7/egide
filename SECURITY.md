# Security policy

Egide is a security product. We hold ourselves to the same standards we
ask our users to apply. See `docs/adr/014-security-by-design.md` and
`docs/security.md` for the full mapping.

## Reporting a vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Email **security@egide.io** with:

- A description of the vulnerability.
- Steps to reproduce.
- Affected versions / commits.
- Optional: suggested fix.

You will receive an acknowledgment within **24 hours** (business days).
An initial assessment will follow within **14 days**.

PGP key for sensitive disclosures: published at
`https://egide.io/.well-known/security.pgp` (when domain is claimed).

## Disclosure policy

We follow a **90-day responsible disclosure** standard:

- Day 0: report received.
- Day 1: acknowledgment.
- Day 14: initial assessment + tentative remediation timeline.
- Day 90 (or sooner if fix shipped): coordinated public disclosure.
- CVE assigned for confirmed vulnerabilities.

Critical vulnerabilities receive an out-of-cycle hotfix on supported
releases.

## Supported versions

| Version | Status | Security updates |
|---|---|---|
| `main` | Pre-release | Continuous |
| `v0.x` | Pre-MVP | Best-effort |
| `v1.x+` | Future stable | Latest minor + previous minor |

Once v1.0 ships, we maintain the latest two minor versions for security
patches.

## Bug bounty

A formal bug bounty program will launch with v1.0 (M20+) via **YesWeHack**
(EU-based) or Intigriti. Until then, recognized researchers are credited
in `SECURITY-CREDITS.md`.

## Secure development practices

- Full-strict secure SDLC from M1 (cf. `docs/adr/016-secure-sdlc.md`).
- SAST (semgrep, gosec, ruff-sec, bandit), SCA (osv-scanner), secrets
  scan (gitleaks), container scan (trivy) bloquant on HIGH/CRITICAL.
- SBOM (CycloneDX) per release. cosign-signed images.
- Threat models per non-trivial feature in `docs/threat-models/`.
- OWASP Web Top 10 (2021) and OWASP LLM Top 10 (2025) explicitly mapped.

## Out of scope

- Self-inflicted misconfigurations (e.g., disabling Postgres RLS).
- Issues requiring local OS-level access on the customer's infra.
- Issues in third-party software (report upstream first).

## Contact

- Security: security@egide.io
- General: hello@egide.io
- GitHub issues (non-security): https://github.com/egide/egide/issues
