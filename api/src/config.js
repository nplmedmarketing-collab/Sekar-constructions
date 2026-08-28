require('dotenv').config();

function requireInProduction(name, value) {
  if (process.env.NODE_ENV === 'production' && (!value || String(value).includes('change-me'))) {
    throw new Error(`Missing or insecure ${name} in production. Set a strong value in .env.`);
  }
}

/**
 * Parse and validate CORS allowlist.
 * - `null` (literal string from misconfigured env / file:// Origin) is always rejected.
 * - `*` is always rejected in production; warned in non-production.
 */
function parseCorsOrigins(raw) {
  const origins = String(raw || 'http://127.0.0.1:5500,http://localhost:5500')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const hasNull = origins.some((o) => o.toLowerCase() === 'null');
  if (hasNull) {
    throw new Error(
      'CORS_ORIGINS must not include "null". Serve pages via Live Server (http://127.0.0.1:5500), never file:// for authenticated testing.'
    );
  }

  const hasStar = origins.some((o) => o === '*');
  const isProd = process.env.NODE_ENV === 'production';
  if (hasStar) {
    if (isProd) {
      throw new Error('CORS_ORIGINS must not include "*" in production. List explicit https origins only.');
    }
    console.warn('[config] WARNING: CORS_ORIGINS includes "*". Do not use this in production.');
  }

  if (isProd && origins.some((o) => /localhost|127\.0\.0\.1/i.test(o))) {
    console.warn('[config] WARNING: CORS_ORIGINS still includes localhost. Tighten for production.');
  }

  return origins;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-session-secret-change-me-32c';
requireInProduction('SESSION_SECRET', SESSION_SECRET);
// Used by: CSRF HMAC, TOTP AES-256-GCM encryption, signed 2FA login challenges (cryptoService).

const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.sqlite';
if (isProd && !/^postgres(ql)?:\/\//.test(DATABASE_URL)) {
  throw new Error('Production requires a PostgreSQL DATABASE_URL. SQLite fallback is not allowed.');
}

const CORS_ORIGINS = parseCorsOrigins(process.env.CORS_ORIGINS);

module.exports = {
  NODE_ENV,
  isProd,
  PORT: Number(process.env.PORT || 3001),
  DATABASE_URL,
  SESSION_SECRET,
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || isProd,
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax'),
  SESSION_HOURS: Number(process.env.SESSION_HOURS || 8),
  CORS_ORIGINS,
  MAX_FAILED_ATTEMPTS: Number(process.env.MAX_FAILED_ATTEMPTS || 5),
  LOCKOUT_MINUTES: Number(process.env.LOCKOUT_MINUTES || 15),
  MAX_TOTP_FAILED_ATTEMPTS: Number(process.env.MAX_TOTP_FAILED_ATTEMPTS || 10),
  TOTP_LOCKOUT_MINUTES: Number(process.env.TOTP_LOCKOUT_MINUTES || 15),
  COOKIE_NAME: 'sc_admin_session',
};
