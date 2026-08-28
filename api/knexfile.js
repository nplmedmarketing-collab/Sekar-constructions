require('dotenv').config();
const path = require('path');
const fs = require('fs');

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.sqlite';
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
  throw new Error('Production requires a PostgreSQL DATABASE_URL (postgres:// or postgresql://). SQLite is not allowed.');
}

/**
 * Postgres SSL:
 * - Production defaults to ssl: { rejectUnauthorized: false } (common for managed DBs with self-signed/proxy certs).
 * - If your provider gives a CA bundle, set PG_SSL_CA to the PEM file path (or inline PEM) and
 *   we use rejectUnauthorized: true with that CA.
 * - Non-production: SSL off unless DATABASE_SSL=true or PG_SSL_CA is set.
 */
function resolvePgSsl() {
  if (process.env.DATABASE_SSL === 'false') {
    return false;
  }
  const caRaw = process.env.PG_SSL_CA;
  if (caRaw) {
    const ca = caRaw.includes('-----BEGIN')
      ? caRaw
      : fs.readFileSync(path.resolve(caRaw), 'utf8');
    return { rejectUnauthorized: true, ca };
  }
  if (isProd || process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  return false;
}

function resolveConnection() {
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    return {
      client: 'pg',
      connection: {
        connectionString: databaseUrl,
        ssl: resolvePgSsl(),
      },
      pool: { min: 0, max: 10 },
      migrations: { directory: path.join(__dirname, 'migrations') },
      seeds: { directory: path.join(__dirname, 'seeds') },
    };
  }

  // SQLite: file:./dev.sqlite or absolute path (development / demos only)
  let filename = databaseUrl;
  if (filename.startsWith('file:')) {
    filename = filename.replace(/^file:/, '');
  }
  if (!path.isAbsolute(filename)) {
    filename = path.join(__dirname, filename);
  }

  return {
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    migrations: { directory: path.join(__dirname, 'migrations') },
    seeds: { directory: path.join(__dirname, 'seeds') },
  };
}

const shared = resolveConnection();

module.exports = {
  development: shared,
  production: shared,
  test: shared,
};
