/**
 * NatsClient — typed wrapper around `nats` library.
 *
 * Validates payloads against `SubjectPayloads` schemas before
 * publish/consume. Adds tenant_id check at consume time.
 *
 * Cf. ADR 008 (NATS JetStream from M1).
 * Cf. ADR 014 §A09 (audit logging — traceId propagated as NATS header).
 */

import {
  connect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
  JSONCodec,
  headers as natsHeaders,
  AckPolicy,
  DeliverPolicy,
  RetentionPolicy,
  StorageType,
} from "nats";
import type { z } from "zod";
import {
  Subjects,
  SubjectPayloads,
  type EgideSubject,
} from "./subjects.js";
import { STREAMS, type StreamDefinition } from "./streams.js";

export interface NatsClientConfig {
  servers: string[];
  name: string;
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
  reconnectMaxAttempts?: number;
}

export interface PublishOptions {
  msgId?: string; // for dedup at NATS level
  expectedLastSubjectSequence?: number;
  /** Audit context for tracing. */
  traceId?: string;
}

export interface ConsumerOptions {
  durable: string;
  maxDeliver?: number; // default 5 ; cf. ADR 008
  ackWaitMs?: number; // default 30s
}

// \u2500\u2500 Internal wire payload wrapper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Every message carries a traceId header for distributed tracing.
const HEADER_TRACE_ID = "Egide-Trace-Id";
const HEADER_TENANT_ID = "Egide-Tenant-Id";

const codec = JSONCodec();

export class NatsClient {
  private conn: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;

  constructor(private readonly config: NatsClientConfig) {}

  async connect(): Promise<void> {
    this.conn = await connect({
      servers: this.config.servers,
      name: this.config.name,
      maxReconnectAttempts: this.config.reconnectMaxAttempts ?? 10,
      // TLS when certs provided (production + mTLS edge agent, cf. ADR 008)
      tls:
        this.config.tlsCa
          ? {
              caFile: this.config.tlsCa,
              certFile: this.config.tlsCert,
              keyFile: this.config.tlsKey,
            }
          : undefined,
    });

    this.js = this.conn.jetstream();
    this.jsm = await this.conn.jetstreamManager();

    // Ensure all streams are provisioned (idempotent — update if exists).
    for (const def of STREAMS) {
      await this.ensureStream(def);
    }
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.drain();
      this.conn = null;
      this.js = null;
      this.jsm = null;
    }
  }

  /** Publish typed payload to a subject. Validates with Zod before send. */
  async publish<S extends EgideSubject>(
    subject: S,
    payload: z.infer<(typeof SubjectPayloads)[S]>,
    opts?: PublishOptions,
  ): Promise<void> {
    if (!this.js) throw new Error("NatsClient not connected — call connect() first");

    // Validate at publish time so we never enqueue garbage.
    const validated = SubjectPayloads[subject].parse(payload);

    const hdrs = natsHeaders();
    if (opts?.traceId) hdrs.set(HEADER_TRACE_ID, opts.traceId);
    // tenantId is always present per SubjectPayloads schema
    hdrs.set(HEADER_TENANT_ID, (validated as { tenantId: string }).tenantId);

    await this.js.publish(subject, codec.encode(validated), {
      headers: hdrs,
      msgID: opts?.msgId,
      expect: opts?.expectedLastSubjectSequence !== undefined
        ? { lastSubjectSequence: opts.expectedLastSubjectSequence }
        : undefined,
    });
  }

  /**
   * Consume from a subject with a typed handler.
   * Handler must throw on failure ; NatsClient handles ack/nak/dlq routing.
   * On MaxDeliver exhaustion, message is forwarded to egide.v1.dlq.
   */
  async consume<S extends EgideSubject>(
    subject: S,
    opts: ConsumerOptions,
    handler: (
      payload: z.infer<(typeof SubjectPayloads)[S]>,
      meta: { tenantId: string; deliveryCount: number; traceId?: string },
    ) => Promise<void>,
  ): Promise<void> {
    if (!this.js) throw new Error("NatsClient not connected — call connect() first");

    const maxDeliver = opts.maxDeliver ?? 5;
    const ackWait = (opts.ackWaitMs ?? 30_000) * 1_000_000; // NATS uses nanoseconds

    const js = this.js;
    const jsm = this.jsm;
    if (!jsm) throw new Error("NatsClient JetStreamManager missing \u2014 call connect() first");

    const consumer = await js.consumers.get(
      this.streamForSubject(subject),
      opts.durable,
    ).catch(async () => {
      // Consumer doesn't exist yet \u2014 create it.
      await jsm.consumers.add(this.streamForSubject(subject), {
        durable_name: opts.durable,
        filter_subject: subject,
        max_deliver: maxDeliver,
        ack_wait: ackWait,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
      });
      return js.consumers.get(this.streamForSubject(subject), opts.durable);
    });

    const messages = await consumer.consume({ max_messages: 1 });

    for await (const msg of messages) {
      const hdrs = msg.headers;
      const tenantId = hdrs?.get(HEADER_TENANT_ID) ?? "";
      const traceId = hdrs?.get(HEADER_TRACE_ID) ?? undefined;
      const deliveryCount = msg.info.redeliveryCount;

      let payload: z.infer<(typeof SubjectPayloads)[S]>;
      try {
        const raw = codec.decode(msg.data);
        payload = SubjectPayloads[subject].parse(raw) as z.infer<(typeof SubjectPayloads)[S]>;
      } catch (parseErr) {
        // Poison pill \u2014 nak immediately to DLQ after 1 attempt
        msg.nak();
        continue;
      }

      try {
        await handler(payload, { tenantId, deliveryCount, traceId });
        msg.ack();
      } catch {
        if (deliveryCount >= maxDeliver - 1) {
          // Exhausted \u2014 let NATS route to DLQ via dead_letter config
          msg.term();
        } else {
          msg.nak();
        }
      }
    }
  }

  // \u2500\u2500 Private helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  private streamForSubject(subject: EgideSubject): string {
    for (const stream of STREAMS) {
      if ((stream.subjects as readonly string[]).includes(subject)) {
        return stream.name;
      }
    }
    throw new Error(`No stream configured for subject: ${subject}`);
  }

  private async ensureStream(def: StreamDefinition): Promise<void> {
    if (!this.jsm) return;
    const config = {
      name: def.name,
      subjects: def.subjects as string[],
      retention: def.retention === "limits"
        ? RetentionPolicy.Limits
        : def.retention === "interest"
          ? RetentionPolicy.Interest
          : RetentionPolicy.Workqueue,
      storage: def.storage === "file" ? StorageType.File : StorageType.Memory,
      max_age: def.maxAgeMs * 1_000_000, // nanoseconds
      max_bytes: def.maxBytes,
      num_replicas: def.replicas,
      description: def.description,
    };
    try {
      await this.jsm.streams.add(config);
    } catch (err: unknown) {
      // 10058 = stream already exists \u2014 update instead
      if (isNatsError(err) && err.code === "10058") {
        await this.jsm.streams.update(def.name, config);
      } else {
        throw err;
      }
    }
  }
}

function isNatsError(err: unknown): err is { code: string } {
  return typeof err === "object" && err !== null && "code" in err;
}

export interface NatsClientConfig {
  servers: string[];
  name: string;
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
  reconnectMaxAttempts?: number;
}

export interface PublishOptions {
  msgId?: string; // for dedup at NATS level
  expectedLastSubjectSequence?: number;
  /** Audit context for tracing. */
  traceId?: string;
}

export interface ConsumerOptions {
  durable: string;
  maxDeliver?: number; // default 5 ; cf. ADR 008
  ackWaitMs?: number; // default 30s
}
