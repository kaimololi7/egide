/**
 * Egide — Drizzle ORM client for Postgres.
 *
 * Tenant isolation is enforced at the application layer (every query filters
 * by `tenantId`). For defense in depth, Postgres RLS policies are applied in
 * production (see deploy/scripts/init-db-rls.sql).
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL (or DATABASE_URL) is required");
}

const queryClient = postgres(connectionString, {
  prepare: false,
  max: 10,
});

export const db = drizzle(queryClient, { schema });
export { schema };
export type DB = typeof db;
