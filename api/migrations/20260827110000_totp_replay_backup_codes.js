/**
 * TOTP replay counter + hashed single-use backup codes.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasLastStep = await knex.schema.hasColumn('admin_users', 'totp_last_step');
  if (!hasLastStep) {
    await knex.schema.alterTable('admin_users', (t) => {
      t.bigInteger('totp_last_step').nullable();
    });
  }

  const hasBackup = await knex.schema.hasTable('admin_backup_codes');
  if (!hasBackup) {
    await knex.schema.createTable('admin_backup_codes', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('admin_users').onDelete('CASCADE');
      t.string('code_hash', 255).notNullable();
      t.timestamp('used_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['user_id', 'used_at']);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('admin_backup_codes');
  const hasLastStep = await knex.schema.hasColumn('admin_users', 'totp_last_step');
  if (hasLastStep) {
    await knex.schema.alterTable('admin_users', (t) => {
      t.dropColumn('totp_last_step');
    });
  }
};
