/**
 * CSRF session binding + wider TOTP secret storage for AES-GCM ciphertext.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const client = String(knex.client.config.client || '');

  if (client === 'pg' || client === 'postgresql') {
    await knex.raw(
      'ALTER TABLE admin_users ALTER COLUMN totp_secret TYPE TEXT USING totp_secret::text'
    );
  } else if (client === 'mysql' || client === 'mysql2') {
    // MariaDB / MySQL: widen varchar → TEXT for encrypted TOTP secrets
    await knex.raw('ALTER TABLE admin_users MODIFY totp_secret TEXT NULL');
  } else {
    // Legacy SQLite path (no longer a supported runtime client)
    const hasCol = await knex.schema.hasColumn('admin_users', 'totp_secret');
    if (hasCol) {
      try {
        await knex.schema.alterTable('admin_users', (t) => {
          t.text('totp_secret').alter();
        });
      } catch {
        /* ignore */
      }
    }
  }

  const hasCsrf = await knex.schema.hasColumn('admin_sessions', 'csrf_token_hash');
  if (!hasCsrf) {
    await knex.schema.alterTable('admin_sessions', (t) => {
      t.string('csrf_token_hash', 128).nullable();
    });
  }
};

exports.down = async function down(knex) {
  const hasCsrf = await knex.schema.hasColumn('admin_sessions', 'csrf_token_hash');
  if (hasCsrf) {
    await knex.schema.alterTable('admin_sessions', (t) => {
      t.dropColumn('csrf_token_hash');
    });
  }
};
