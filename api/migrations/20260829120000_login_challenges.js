/**
 * Persist single-use 2FA login challenges (prevent challenge-token reuse).
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasTable = await knex.schema.hasTable('login_challenges');
  if (!hasTable) {
    await knex.schema.createTable('login_challenges', (t) => {
      t.increments('id').primary();
      t.string('challenge_hash', 64).notNullable().unique();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('admin_users').onDelete('CASCADE');
      t.timestamp('expires_at').notNullable();
      t.timestamp('used_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['user_id']);
      t.index(['expires_at']);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('login_challenges');
};
