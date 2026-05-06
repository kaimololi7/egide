# Tutorial 1 — ISO 27001 + NIS2 from an Ansible inventory

You have an Ansible inventory describing your fleet (databases, web
servers, Kubernetes clusters). You also have a handful of ISMS source
documents — an existing PSSI, a NIS2 risk assessment, a backup
procedure. You want a **verifiable pyramid** covering ISO 27001 (2022)
and NIS2 (2024) plus runnable Rego + Ansible.

This tutorial walks the full path. **Estimated time: 15–20 min.**

## 0. Pre-requisites

- Egide running locally (cf. [`README.md`](../../README.md) Quick start).
- One LLM provider configured, **or** template-only mode (Egide will
  produce a usable pyramid without any LLM call).
- `egide` CLI on your `PATH` (see [`apps/cli/README.md`](../../apps/cli/README.md)).

## 1. Bring your sources

Drop everything into a single folder:

```sh
mkdir -p ./demo-sources
cp ~/work/pssi-2024.pdf ./demo-sources/
cp ~/work/risk-assessment-nis2.docx ./demo-sources/
cp ~/work/inventory.yml ./demo-sources/        # your Ansible inventory
```

Egide accepts PDF, DOCX, MD, YAML, and plain TXT. The Ansible inventory
is parsed for hostgroups so the compiler knows which playbook targets to
emit.

## 2. Generate the pyramid

```sh
egide pyramid generate \
  --sources ./demo-sources \
  --framework iso27001,nis2 \
  --output ./demo-pyramid.json
```

What happens behind the scenes (cf. ADR 011 + 012) :

1. **J1 state machine** in `agents/orchestrator` consumes
   `egide.v1.j1.start` and walks the phases EXTRACT → CLASSIFY → ANCHOR
   → DRAFT → VALIDATE → PERSIST.
2. **Extractor** (Python, Docling) turns each document into anchored
   chunks with provenance.
3. **agents/compliance super-agent** classifies each chunk against the
   selected frameworks and resolves normative anchors via pgvector RAG.
4. **Drafting** uses your configured LLM provider, or templates if none
   is set, to produce policy/procedure prose with cited anchors.
5. **Validator** (Go, hexagonal) runs the 25 deterministic coherence
   rules + the hallucination guard.
6. **Persistence** writes to `pyramids` + `pyramid_versions` with full
   audit trail.

The web UI at `http://localhost:3000/pyramids/<id>` shows the live
progress (SSE backed by `egide.v1.pyramid.progress` on NATS).

## 3. Inspect the cascade

```sh
egide pyramid inspect <pyramid-id> --depth 3
```

You should see a tree :

```
Directive: information security policy
  Policy: backup and recovery
    Procedure: nightly database backup
      Process: postgres dump → S3 with retention 30d
        KPI: backup success rate ≥ 99.5% / month
```

Every node carries citations to ISO 27001 controls (`A.8.13`, `A.5.30`)
and NIS2 articles (`Art.21.2.c`, `Art.23`).

## 4. Compile to Rego + Ansible

```sh
# Compile the backup policy to a Rego bundle
egide compile rego --pyramid <pyramid-id> --policy backup-and-recovery \
  --out ./bundle.rego

# Compile the same policy to an Ansible playbook + Molecule scenario
egide compile ansible --pyramid <pyramid-id> --policy backup-and-recovery \
  --out ./ansible/
```

Output of the Ansible compile :

```
ansible/
  playbook.yml
  molecule/default/
    molecule.yml
    converge.yml
    verify.yml
    prepare.yml
```

## 5. Test the artefacts

```sh
# Rego — opa eval offline (no cluster needed)
opa eval --data ./bundle.rego --input ./fixtures/bad-deploy.json \
  'data.egide.deny'

# Ansible — molecule scenario (requires Docker + molecule[docker])
cd ansible && molecule test
```

## 6. Sign off and export OSCAL

```sh
egide audit export-oscal --pyramid <pyramid-id> --out ./ssp.json
```

This produces an OSCAL 1.1.2 System Security Plan referencing every
implemented control with citation back to the source document. Pro
edition signs it with Ed25519 ; Community ships it as plain JSON.

## What you've validated

- ✅ ISO 27001 + NIS2 framework anchors resolved automatically
- ✅ Pyramid traceable end-to-end (directive → KPI)
- ✅ Same policy compiled to two enforcement targets from one IR
- ✅ Negative fixture rejected by OPA (Rego) and Molecule (Ansible)
- ✅ OSCAL SSP exportable to your auditor

Next: [Tutorial 2 — From policy to Rego + Ansible](02-policy-to-rego-and-ansible.md).
