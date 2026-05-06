/**
 * NATS connection singleton for the Next.js server runtime.
 *
 * Used by SSE routes (e.g. /api/pyramid-progress/[id]) to subscribe to
 * `egide.v1.pyramid.progress` events published by the orchestrator
 * (cf. agents/orchestrator/src/agents_orchestrator/worker.py).
 *
 * One NATS connection is reused across requests. Each SSE request
 * creates an ephemeral JetStream consumer and tears it down when the
 * client disconnects.
 *
 * Cf. ADR 008 (NATS JetStream from M1).
 */
import { connect, type NatsConnection, type JetStreamClient } from "nats";

let _conn: NatsConnection | null = null;
let _connPromise: Promise<NatsConnection> | null = null;

const NATS_URL = process.env.EGIDE_NATS_URL ?? "nats://localhost:4222";

export async function getNatsConnection(): Promise<NatsConnection> {
  if (_conn && !_conn.isClosed()) return _conn;
  if (_connPromise) return _connPromise;

  _connPromise = connect({
    servers: NATS_URL.split(","),
    name: "egide-web",
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2000,
  })
    .then((c) => {
      _conn = c;
      _connPromise = null;
      // Async cleanup on close; do not await.
      void (async () => {
        for await (const _status of c.status()) {
          // status events are informational; reset on disconnect.
        }
        _conn = null;
      })();
      return c;
    })
    .catch((err) => {
      _connPromise = null;
      throw err;
    });

  return _connPromise;
}

export async function getJetStream(): Promise<JetStreamClient> {
  const c = await getNatsConnection();
  return c.jetstream();
}
