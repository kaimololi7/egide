/**
 * @egide/messaging — typed NATS JetStream client (cf. ADR 008).
 *
 * Single source of truth for NATS subjects, stream definitions, and
 * publish/subscribe helpers. Used by apps/api (publisher) and Python
 * AI workers (via nats-py with the same subject conventions).
 *
 * Status: scaffold. Implementation lands at M1 sprint S2.
 */

export { NatsClient } from "./client.js";
export type { NatsClientConfig, PublishOptions } from "./client.js";

export {
  Subjects,
  isEgideSubject,
  parseSubject,
} from "./subjects.js";
export type { EgideSubject, SubjectPayloads } from "./subjects.js";

export { STREAMS, ensureStreams } from "./streams.js";
export type { StreamDefinition } from "./streams.js";
