<!--
Thank you for contributing to Egide.

Read CONTRIBUTING.md before opening. PRs that skip the security
checklist will be requested changes.
-->

## Summary

<!-- 1-3 sentences. What changes, why. Link to ADR if architectural. -->

## Bounded context (cf. ADR 015)

<!-- Pick one: pyramid / compilation / compliance / audit / governance / shared -->

Bounded context: ...

## Type of change

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] refactor — no behavior change
- [ ] docs — documentation only
- [ ] test — tests only
- [ ] chore — tooling, deps
- [ ] ci — CI/CD only

## Security checklist (cf. ADR 014 + 016)

<!-- Tick the boxes that apply. Untick the rest with explanation. -->

- [ ] No secrets, keys, credentials, or test fixtures with real PII added.
- [ ] Authorization checks added/reviewed for new endpoints (deny-by-default).
- [ ] Multi-tenant isolation respected (every query filters by tenant_id).
- [ ] Input validation at trust boundaries (parsing, deserialization, prompts).
- [ ] Output sanitization where rendered (HTML, logs, LLM prompts).
- [ ] OWASP Web Top 10 items considered (link relevant ADR 014 §A0X).
- [ ] OWASP LLM Top 10 items considered (link relevant ADR 014 §LLM0X)
      — only if the change touches LLM calls, prompts, RAG, or AI workers.
- [ ] Threat model added/updated in `docs/threat-models/<slug>.md`
      — required for non-trivial features (cf. ADR 016 definition).
- [ ] Audit log entries added for new security-relevant actions.
- [ ] Tests cover the change (unit + integration + adversarial when relevant).

## Architectural checklist (cf. ADR 015)

- [ ] Respects bounded context boundaries (no cross-context import).
- [ ] Uses the repository pattern for persistence (not raw SQL in use cases).
- [ ] API versioned from v1 (no unversioned external endpoint).
- [ ] Idempotency-Key supported on mutating endpoints.
- [ ] Reversible Drizzle migration (up + down + rollforward tested in CI).
- [ ] Errors use the common error taxonomy (`packages/errors`).
- [ ] OpenTelemetry trace_id propagated through new code paths.

## Front-end checklist (only if `apps/web` or `packages/ui` touched)

<!-- cf. ADR 017 + docs/design-system.md -->

- [ ] No hard-coded colors, fonts, radii, or shadows — tokens only.
- [ ] No box-shadow elevation (border 1px or background shift).
- [ ] No decorative animation (rotate, float, glow, parallax).
- [ ] No icon in a colored circle.
- [ ] No AI-generated images.
- [ ] No banned copy phrases (`AI-powered`, `unlock`, `seamless`, etc.).
- [ ] Signature components used where the metier matches.
- [ ] Accessibility: keyboard navigation + focus visible + WCAG 2.2 AA.

## Linked issues / ADRs / threat models

<!-- e.g.:
Closes #42
Implements ADR 015
Threat model: docs/threat-models/api-gateway.md
-->

## Notes for reviewer

<!-- Anything non-obvious. Trade-offs. Things you tried and rolled back. -->
