# Proxmox VE — API connector

Proxmox VE is the dominant open-source hypervisor in EU mid-market on-prem
infrastructure (alternative to VMware vSphere). Egide's pipeline service
includes a Proxmox connector to inventory VMs, audit configurations, and
detect drift. This is a Pro/Enterprise feature and a structural sovereignty
differentiator.

## Why Proxmox matters for Egide

| Reason | Impact |
|---|---|
| EU customers leave VMware after Broadcom acquisition (2024) | Proxmox adoption surged in 2025-2026 |
| OVH, Scaleway, regional French/EU hosters offer Proxmox-as-a-service | Sovereign cloud baseline |
| Proxmox is FOSS, fully on-prem capable | Aligns with our air-gapped Enterprise edition |
| No Vanta/Drata supports Proxmox | Pure differentiator |

## API basics

Proxmox VE 8.x exposes a REST API at `https://<node>:8006/api2/json`.
Authentication: API tokens (recommended) or PVE/PAM tickets.

```bash
# Token format: PVEAPIToken=USER@REALM!TOKENID=UUID
export PVE_TOKEN="root@pam!egide-readonly=12345678-..."

curl -k -H "Authorization: $PVE_TOKEN" \
  "https://pve1:8006/api2/json/nodes/pve1/qemu"
```

Key endpoints used by the connector:

| Endpoint | Returns | Egide use |
|---|---|---|
| `/cluster/status` | nodes, quorum | health, sovereignty (region check) |
| `/nodes/{node}/qemu` | VMs (KVM) | inventory |
| `/nodes/{node}/lxc` | containers | inventory |
| `/nodes/{node}/qemu/{vmid}/config` | VM config | audit (disk encryption, isolation) |
| `/nodes/{node}/qemu/{vmid}/agent/get-osinfo` | OS info from guest agent | posture |
| `/cluster/backup` | backup jobs | audit (retention, frequency) |
| `/access/users` | users | audit (RBAC, MFA) |
| `/access/acl` | access control | audit (privilege creep) |
| `/storage` | storage definitions | audit (encryption, replication) |

## Connector responsibilities (services/pipeline/connectors/proxmox)

The Go connector:

1. **Authenticates** with the API token configured per integration row in
   `integrations` table (encrypted).
2. **Discovers** nodes, VMs, containers, storage, users, ACLs.
3. **Normalizes** discovered entities into Egide's `Asset` schema.
4. **Maps to controls** via deterministic rules:
   - VM without backup → finding linked to ISO 27001 A.5.30 / cluster:business-continuity
   - User without MFA → finding linked to ISO 27001 A.5.17 / NIS2 21.2.j
   - Storage without encryption → finding linked to ISO 27001 A.8.24 / HDS
   - VM in non-EU node (label-based) → finding linked to RGPD Art. 44
5. **Publishes** findings to NATS subject `egide.compliance.findings` for
   ingestion by the auditor view (J5) and continuous compliance dashboard (J4).

## Read-only by default

Egide's Proxmox connector is **read-only** in MVP. We never call POST/PUT/DELETE
endpoints on the customer's Proxmox cluster.

In M11+, an "Apply" mode for J9 (analogous to Ansible) may add scoped writes —
but only with explicit per-action approval and audit. For now, the connector
is purely an inventory + audit source.

## Tenant isolation

Proxmox API tokens are tenant-scoped. The integration row in `integrations`
table holds the encrypted token; the connector decrypts at sync time and
discards from memory after use.

We recommend customers create a **dedicated API token** for Egide with the
minimum role (`PVEAuditor` or custom with `Datastore.Audit`, `VM.Audit`, `Sys.Audit`).

## Rate limits and pagination

Proxmox API has no built-in rate limiting but heavy concurrent calls can
saturate the cluster. The connector:

- Uses `MaxConcurrency: 4` per node by default.
- Caches `/cluster/status` for 60s.
- Does full sync nightly + incremental every 15 minutes.

## TLS handling

Most on-prem Proxmox installs use self-signed certificates. The connector
supports:

- `tls_skip_verify: true` (NOT recommended; logs a warning)
- `tls_ca_pem: "..."` (recommended; customer pins the CA)
- `tls_fingerprint: "sha256:..."` (alternative; locks to a specific cert)

The integration UI guides customers to the recommended path.

## Health monitoring

The connector exposes Prometheus metrics under `/metrics`:

- `egide_proxmox_sync_total{status="success|failure"}`
- `egide_proxmox_sync_duration_seconds`
- `egide_proxmox_assets_total{kind="vm|lxc|node|storage"}`
- `egide_proxmox_findings_total{severity="error|warn|info"}`

## Testing

The connector is tested against:

- A **mock Proxmox API** (Go HTTP test server returning canned responses) for unit tests.
- A **real Proxmox VE 8.x** in a Vagrant box for integration tests (run on demand).

## Reference paths

- `services/pipeline/connectors/proxmox/` — Go connector
- `services/pipeline/connectors/proxmox/normalizer.go` — Proxmox → Asset mapping
- `services/pipeline/connectors/proxmox/audit_rules.go` — finding generation
- Upstream: <https://pve.proxmox.com/wiki/Proxmox_VE_API>
- Schema: <https://pve.proxmox.com/pve-docs/api-viewer/>

## Versions to track

- Proxmox VE 7.4 LTS (until end-of-life ~2027)
- Proxmox VE 8.x (current)
- Proxmox VE 9.x (when released; expect compatibility break)

## Don'ts

- Don't store API tokens in plain text. Always encrypted at rest.
- Don't hammer `/cluster/resources` on every poll — cache aggressively.
- Don't do POST/PUT/DELETE in MVP. Read-only.
- Don't auto-enroll discovered VMs as Egide-managed assets without user opt-in
  (privacy-by-default).
