/**
 * One-off: copy all CMS/auth rows from a source SQLite file into MariaDB.
 * Does NOT run seeds. Preserves primary keys / FK order.
 *
 * Usage (from api/):
 *   node scripts/migrate-sqlite-to-mariadb.js
 *   node scripts/migrate-sqlite-to-mariadb.js --source ./dev.sqlite
 *
 * Requires DATABASE_URL (mysql:// or mariadb://) or DB_* discrete vars already set.
 * better-sqlite3 is used only as a read-only import helper for the legacy file.
 */
require('dotenv').config();
const path = require('path');
const knex = require('knex');
const knexConfig = require('../knexfile');

const SKIP_TABLES = new Set(['knex_migrations', 'knex_migrations_lock', 'sqlite_sequence']);

/** Parent-before-child order for FK safety (also used with FOREIGN_KEY_CHECKS=0). */
const PREFERRED_ORDER = [
  'admin_users',
  'admin_sessions',
  'admin_lockouts',
  'admin_backup_codes',
  'login_challenges',
  'audit_logs',
  'page_content',
  'page_highlights',
  'infra_inventory',
  'projects',
  'gallery_case_studies',
  'gallery_images',
  'gallery_media_items',
  'fleet_assets',
  'financial_sections',
  'financial_turnover_years',
  'team_photos',
  'inquiries',
];

function parseArgs(argv) {
  let source = path.join(__dirname, '..', 'dev.sqlite');
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--source' && argv[i + 1]) {
      source = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return { source };
}

function normalizeRow(row) {
  const out = { ...row };
  // SQLite stores booleans as 0/1; mysql2/Knex accept numbers or booleans.
  for (const [k, v] of Object.entries(out)) {
    if (Buffer.isBuffer(v)) {
      out[k] = v.toString('utf8');
    }
  }
  return out;
}

async function main() {
  const { source } = parseArgs(process.argv.slice(2));
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (err) {
    console.error('better-sqlite3 is required to read the legacy SQLite source file.');
    console.error('Install temporarily: npm install better-sqlite3 --no-save');
    process.exit(1);
  }

  if (!require('fs').existsSync(source)) {
    console.error(`Source SQLite not found: ${source}`);
    process.exit(1);
  }

  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const dest = knex(knexConfig[env] || knexConfig.development);
  const src = new Database(source, { readonly: true });

  console.log(`[migrate] source=${source}`);
  console.log(`[migrate] dest client=${dest.client.config.client}`);

  try {
    await dest.raw('SELECT 1 AS ok');
    console.log('[migrate] MariaDB connection OK');
  } catch (err) {
    console.error('[migrate] MariaDB connection FAILED:', err.message);
    src.close();
    await dest.destroy();
    process.exit(1);
  }

  const srcTables = src
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map((r) => r.name)
    .filter((n) => !SKIP_TABLES.has(n));

  const ordered = [
    ...PREFERRED_ORDER.filter((t) => srcTables.includes(t)),
    ...srcTables.filter((t) => !PREFERRED_ORDER.includes(t)),
  ];

  const counts = {};

  await dest.raw('SET FOREIGN_KEY_CHECKS=0');
  try {
    for (const table of ordered) {
      const rows = src.prepare(`SELECT * FROM "${table}"`).all().map(normalizeRow);
      counts[table] = { source: rows.length, dest: 0 };

      // Clear any rows created by migrations that embed inserts (gallery_*, etc.)
      await dest(table).del();

      if (rows.length === 0) {
        console.log(`[migrate] ${table}: 0 rows`);
        continue;
      }

      const chunk = 100;
      for (let i = 0; i < rows.length; i += chunk) {
        await dest(table).insert(rows.slice(i, i + chunk));
      }

      const [{ c }] = await dest(table).count({ c: '*' });
      counts[table].dest = Number(c);
      console.log(`[migrate] ${table}: ${counts[table].source} → ${counts[table].dest}`);

      if (counts[table].source !== counts[table].dest) {
        throw new Error(`Row count mismatch for ${table}`);
      }
    }
  } finally {
    await dest.raw('SET FOREIGN_KEY_CHECKS=1');
  }

  // Reset AUTO_INCREMENT to max(id)+1 where an id column exists
  for (const table of ordered) {
    const hasId = await dest.schema.hasColumn(table, 'id');
    if (!hasId) continue;
    const row = await dest(table).max({ m: 'id' }).first();
    const maxId = Number(row && row.m) || 0;
    if (maxId > 0) {
      await dest.raw(`ALTER TABLE ?? AUTO_INCREMENT = ?`, [table, maxId + 1]);
    }
  }

  console.log('[migrate] DONE — do not run npm run seed (would overwrite CMS content).');
  src.close();
  await dest.destroy();
}

main().catch(async (err) => {
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});
