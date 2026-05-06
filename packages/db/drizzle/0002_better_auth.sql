-- Egide — Better-Auth tables (sessions, accounts, verification).
-- Migration 0002. Generated 2026-05-15.
--
-- Better-Auth requires 4 tables next to the existing `users` table:
--   - account     : OAuth provider link + password hash
--   - session     : active sessions (token, expiry, IP, UA)
--   - verification: one-time tokens for email verification + password reset
--
-- The existing `users` table (from 0001_initial) is reused. We add the
-- columns Better-Auth expects (emailVerified flag + image).

-- ── Patch users with Better-Auth required columns ─────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── account ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account (
    id text PRIMARY KEY,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scope text,
    password text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, account_id)
);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON account(user_id);

-- ── session ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session (
    id text PRIMARY KEY,
    expires_at timestamptz NOT NULL,
    token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id);
CREATE INDEX IF NOT EXISTS session_expires_at_idx ON session(expires_at);

-- ── verification ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification (
    id text PRIMARY KEY,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

-- ── rateLimit (Better-Auth optional — kept for production hardening) ────────
CREATE TABLE IF NOT EXISTS rate_limit (
    id text PRIMARY KEY,
    key text NOT NULL,
    count integer NOT NULL DEFAULT 0,
    last_request bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_key_idx ON rate_limit(key);
