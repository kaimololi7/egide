# @egide/messaging

Typed NATS JetStream client. Implements ADR 008.

## Status

Scaffold. Subjects, payload schemas, stream definitions, and client
skeleton in place. Implementation lands at M1 sprint S2.

## Why

NATS JetStream is the single message bus from M1 (cf. ADR 008). This
package centralizes:

- Subject naming convention (`egide.v1.<domain>.<action>`)
- Per-subject payload schemas (Zod)
- Stream definitions (JOBS / EVENTS / FINDINGS / DLQ)
- Type-safe publish/consume helpers
- Tenant-scoped payload validation

## Usage (after S2)

```ts
import { NatsClient, Subjects } from "@egide/messaging";

const nats = new NatsClient({
  servers: ["nats://localhost:4222"],
  name: "egide-api",
});
await nats.connect();

// Publish
await nats.publish(Subjects.PyramidRequested, {
  tenantId: ctx.tenantId,
  requestId: crypto.randomUUID(),
  targetFrameworks: ["iso27001-2022", "nis2"],
  inputDocIds: docs.map((d) => d.id),
});

// Consume
await nats.consume(
  Subjects.PyramidRequested,
  { durable: "egide-orchestrator" },
  async (payload, meta) => {
    await orchestrate(payload, meta.traceId);
  },
);
```

## Reference

- ADR 008 — Job queue and event bus
- `docs/architecture.md` — event bus section
