/**
 * NATS JetStream definitions (cf. ADR 008).
 *
 * Three streams covering all subjects:
 * - JOBS    — work queue (ack-based)
 * - EVENTS  — replayable history
 * - FINDINGS — compliance findings (J4 dashboard)
 */

import { Subjects, type EgideSubject } from "./subjects.js";

export interface StreamDefinition {
  name: string;
  subjects: EgideSubject[];
  retention: "limits" | "interest" | "workqueue";
  storage: "file" | "memory";
  maxAgeMs: number;
  maxBytes: number;
  replicas: number;
  description: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_GB = 1 * 1024 * 1024 * 1024;

export const STREAMS: StreamDefinition[] = [
  {
    name: "JOBS",
    subjects: [
      Subjects.PyramidRequested,
      Subjects.CompilerRequested,
      Subjects.DocsUploaded,
    ],
    retention: "workqueue",
    storage: "file",
    maxAgeMs: 7 * ONE_DAY_MS,
    maxBytes: ONE_GB,
    replicas: 1, // 3 in prod via Helm overlay
    description: "Async job dispatch — ack-based, DLQ on MaxDeliver=5",
  },
  {
    name: "EVENTS",
    subjects: [
      Subjects.DocsExtracted,
      Subjects.PyramidGenerated,
      Subjects.PyramidMutations,
      Subjects.PyramidProgress,
      Subjects.CompilerCompleted,
      Subjects.AuditEvents,
      Subjects.GovernanceActions,
      Subjects.LlmCalls,
    ],
    retention: "limits",
    storage: "file",
    maxAgeMs: 7 * ONE_DAY_MS,
    maxBytes: ONE_GB,
    replicas: 1,
    description: "Event log, replayable. 7 day retention default.",
  },
  {
    name: "FINDINGS",
    subjects: [Subjects.ComplianceFindings],
    retention: "limits",
    storage: "file",
    maxAgeMs: 30 * ONE_DAY_MS,
    maxBytes: ONE_GB,
    replicas: 1,
    description: "Drift / gap findings driving the J4 continuous-compliance dashboard.",
  },
  {
    name: "DLQ",
    subjects: [Subjects.Dlq],
    retention: "limits",
    storage: "file",
    maxAgeMs: 30 * ONE_DAY_MS,
    maxBytes: ONE_GB,
    replicas: 1,
    description: "Dead-letter queue. Manual replay via `egide jobs replay`.",
  },
];

/**
 * Ensure all streams exist. Idempotent. Called on app startup.
 *
 * Status: scaffold. Implementation lands at M1 sprint S2.
 */
export async function ensureStreams(_jsm: unknown): Promise<void> {
  // for (const def of STREAMS) {
  //   await jsm.streams.add({
  //     name: def.name,
  //     subjects: def.subjects,
  //     retention: def.retention,
  //     storage: def.storage,
  //     max_age: def.maxAgeMs * 1_000_000, // ns
  //     max_bytes: def.maxBytes,
  //     num_replicas: def.replicas,
  //   });
  // }
}
