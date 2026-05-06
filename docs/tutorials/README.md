# Egide tutorials

Hands-on walk-throughs for the M6 public release. Each tutorial is
self-contained, links to the relevant ADRs, and uses only Community
edition features.

## Available tutorials

1. [**ISO 27001 + NIS2 from an Ansible inventory**](01-iso27001-nis2-from-ansible.md)
   — drop your Ansible inventory + a few ISMS source PDFs, get a verifiable
   pyramid covering both frameworks plus runnable Rego + Ansible.
2. [**From policy to Rego + Ansible**](02-policy-to-rego-and-ansible.md)
   — author a policy in the web UI, compile to both targets, run the OPA
   bundle locally and the Ansible playbook with Molecule.

## Running the tutorials

All tutorials assume:

- Repo cloned, dependencies installed (`pnpm install` + `uv sync`).
- Dev infra running: `docker compose -f deploy/docker/compose.yaml up -d`.
- API + worker running: `pnpm --filter @egide/api dev` + the orchestrator.

If you only want to see the end-to-end happen without authoring anything,
run [`./scripts/e2e-demo.sh`](../../scripts/e2e-demo.sh).
