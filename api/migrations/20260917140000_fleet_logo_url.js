/**
 * Add optional logo_url for fleet asset cards (custom logo image).
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('fleet_assets', 'logo_url');
  if (!has) {
    await knex.schema.alterTable('fleet_assets', (t) => {
      t.text('logo_url').nullable();
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn('fleet_assets', 'logo_url');
  if (has) {
    await knex.schema.alterTable('fleet_assets', (t) => {
      t.dropColumn('logo_url');
    });
  }
};
