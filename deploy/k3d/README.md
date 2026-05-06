# Egide — k3d demo sandbox

Minimal local Kubernetes cluster used by [scripts/e2e-demo.sh](../../scripts/e2e-demo.sh)
to validate the M5 exit criterion: a Rego bundle compiled from a generated
pyramid actually blocks a non-conforming Kubernetes deployment.

Cf. [docs/roadmap.md](../../docs/roadmap.md) M5 exit criteria, ADR 005
(Policy-as-Code multi-target).

## Quick start

```sh
# create cluster
k3d cluster create --config deploy/k3d/cluster.yaml

# run the full e2e demo (extract → pyramid → compile → admit/deny)
./scripts/e2e-demo.sh

# teardown
./scripts/e2e-demo.sh --teardown
```

## What's inside

- Single-server, single-agent k3s (v1.30.4) cluster, `traefik` disabled.
- Local registry at `egide-registry:5050` for pushing dev images without
  hitting a public registry (air-gappable demo).
- HTTP/HTTPS exposed on `127.0.0.1:8080/8443`.
- The e2e script deploys an OPA server in `egide-system` with the
  compiled Rego bundle mounted via ConfigMap.

## Why not Kyverno here?

Kyverno is a M10 deliverable (cf. ADR 005). For the M5 demo we keep
the path narrow: Rego only, evaluated by OPA. Kyverno will reuse the
Intent IR via a different generator.
