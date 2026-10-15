require('dotenv').config();
const path = require('path');
const fs = require('fs');

const databaseUrl = process.env.DATABASE_URL || '';
const isProd = process.env.NODE_ENV === 'production';

/**
 * MariaDB / MySQL only. Accepts mysql:// or mariadb:// URLs.
 * Password special characters must be percent-encoded in DATABASE_URL
 * (e.g. @ → %40) or use discrete DB_* env vars (see resolveConnection).
 */
function assertMariaUrl(url) {
  if (!url || !/^(mysql|mariadb):\/\//i.test(url)) {
    throw new Error(
      'DATABASE_URL must be a MariaDB/MySQL URL (mysql:// or mariadb://). ' +
        'SQLite and PostgreSQL are not supported.'
    );
  }
}

/**
 * Optional discrete env vars when URL-encoding the password is inconvenient:
 * DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */
function connectionFromDiscreteEnv() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  if (!host || !user || !database) return null;
  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user,
    password: password == null ? '' : String(password),
    database,
    charset: 'utf8mb4',
  };
}

/**
 * SSL for managed MariaDB/MySQL:
 * - Production defaults to ssl: { rejectUnauthorized: false } unless DATABASE_SSL=false.
 * - If MYSQL_SSL_CA / PG_SSL_CA is set to a PEM path or inline PEM, use rejectUnauthorized: true.
 * - Non-production: SSL off unless DATABASE_SSL=true or a CA is set.
 */
function resolveMysqlSsl() {
  if (process.env.DATABASE_SSL === 'false') {
    return undefined;
  }
  const caRaw = process.env.MYSQL_SSL_CA || process.env.PG_SSL_CA;
  if (caRaw) {
    const ca = caRaw.includes('-----BEGIN')
      ? caRaw
      : fs.readFileSync(path.resolve(caRaw), 'utf8');
    return { rejectUnauthorized: true, ca };
  }
  if (isProd || process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function resolveConnection() {
  const discrete = connectionFromDiscreteEnv();
  if (discrete) {
    const ssl = resolveMysqlSsl();
    return {
      client: 'mysql2',
      connection: ssl ? { ...discrete, ssl } : discrete,
      pool: { min: 0, max: 10 },
      migrations: { directory: path.join(__dirname, 'migrations') },
      seeds: { directory: path.join(__dirname, 'seeds') },
    };
  }

  assertMariaUrl(databaseUrl);

  // knex/mysql2 accept mysql://; normalize mariadb:// → mysql:// for the driver
  const connectionString = databaseUrl.replace(/^mariadb:/i, 'mysql:');
  const ssl = resolveMysqlSsl();

  return {
    client: 'mysql2',
    connection: ssl
      ? { uri: connectionString, ssl }
      : connectionString,
    pool: { min: 0, max: 10 },
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
