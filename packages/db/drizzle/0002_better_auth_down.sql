-- Down migration for 0002_better_auth.sql.

DROP TABLE IF EXISTS rate_limit;
DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS account;

ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
ALTER TABLE users DROP COLUMN IF EXISTS image;
ALTER TABLE users DROP COLUMN IF EXISTS updated_at;
