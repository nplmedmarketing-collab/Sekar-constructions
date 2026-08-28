/**
 * CSRF session binding + wider TOTP secret storage for AES-GCM ciphertext.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const client = knex.client.config.client;

  if (client === 'pg' || client === 'postgresql') {
    await knex.raw(
      'ALTER TABLE admin_users ALTER COLUMN totp_secret TYPE TEXT USING totp_secret::text'
    );
  } else {
    // SQLite: recreate column via table copy if needed; Knex alter may no-op on type.
    const hasCol = await knex.schema.hasColumn('admin_users', 'totp_secret');
    if (hasCol) {
      try {
        await knex.schema.alterTable('admin_users', (t) => {
          t.text('totp_secret').alter();
        });
      } catch {
        /* SQLite < 3.35 — column stays varchar; encrypted secrets still fit at ~100 chars */
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
