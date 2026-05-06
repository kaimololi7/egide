# Egide Helm chart

Sovereign-by-default Kubernetes deployment for the Egide platform.

## Quick start

```bash
helm repo add egide https://charts.egide.eu  # not yet published — for now use ./
helm install egide ./deploy/helm \
  --namespace egide --create-namespace \
  --set auth.secret="$(openssl rand -base64 48)" \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=egide.example.com
```

## Edition matrix

| Edition       | What you get                                            |
| ------------- | ------------------------------------------------------- |
| community     | api + web + validator + compiler + extractor + bundled deps |
| professional  | + edge agent + Proxmox/AWS collectors + signed exports |
| enterprise    | + air-gapped bundle + SSO + SLA + signed Ed25519 OSCAL |

Set via `--set global.edition=community|professional|enterprise`.

## Bundled vs external dependencies

The chart can either bundle Postgres / Redis / NATS / MinIO via subcharts,
or point to managed services. Toggle each via `<dep>.enabled=false` and
fill the matching `external.<dep>Url`.

```bash
# Use Scaleway managed Postgres + S3 instead of bundled
helm install egide ./deploy/helm \
  --set postgresql.enabled=false \
  --set minio.enabled=false \
  --set external.postgresUrl="postgres://..." \
  --set external.s3Endpoint="https://s3.fr-par.scw.cloud" \
  --set external.s3AccessKey="..." \
  --set external.s3SecretKey="..."
```

## Sovereignty defaults

- No image is pulled from a non-EU registry by default.
  `global.egideImageRegistry` defaults to `ghcr.io/egide-grc` — override
  with your own EU mirror for air-gapped installs.
- No third-party CDN is loaded at runtime by `web` (see ADR 017).
- NetworkPolicy is enabled by default to restrict egress.

## Hardening

Pod security defaults:

- runAsNonRoot, readOnlyRootFilesystem, drop ALL capabilities,
  seccompProfile=RuntimeDefault.
- PodDisruptionBudget enabled (minAvailable=1).
- Better-Auth secret enforced via Secret (chart fails install if empty).

## Status

**Skeleton — M1 sprint deliverable.** Templates land progressively:

- [x] Chart.yaml + values.yaml
- [ ] Deployments for api, validator, compiler, extractor, web
- [ ] Services + Ingress
- [ ] Secrets (auth, LLM keys, DB credentials)
- [ ] PostgreSQL subchart wiring
- [ ] NATS subchart wiring
- [ ] post-install Job to apply RLS migration (`0003_rls.sql`)
- [ ] NetworkPolicy templates
- [ ] HorizontalPodAutoscaler (Pro+)
- [ ] ServiceMonitor (Prometheus, Pro+)

Per the roadmap, the chart reaches production-ready status at M6
(public open-source release).
