/**
 * Initial CMS + auth schema — portable SQLite / PostgreSQL types via Knex.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('admin_users', (t) => {
    t.increments('id').primary();
    t.string('username', 64).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.boolean('must_change_password').notNullable().defaultTo(true);
    t.string('totp_secret', 64).nullable(); // phase-2 TOTP
    t.boolean('totp_enabled').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('admin_sessions', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable()
      .references('id').inTable('admin_users').onDelete('CASCADE');
    t.string('token_hash', 128).notNullable().unique();
    t.timestamp('expires_at').notNullable();
    t.string('ip', 64).nullable();
    t.string('user_agent', 512).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('admin_lockouts', (t) => {
    t.increments('id').primary();
    t.string('username', 64).notNullable().unique();
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('locked_until').nullable();
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary();
    t.string('event', 128).notNullable();
    t.text('details').nullable();
    t.string('level', 32).notNullable().defaultTo('INFO');
    t.string('ip', 64).nullable();
    t.integer('user_id').unsigned().nullable()
      .references('id').inTable('admin_users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('page_content', (t) => {
    t.increments('id').primary();
    t.string('page_key', 64).notNullable().unique(); // infrastructure | ongoing | completed | gallery
    t.string('brand', 255).notNullable();
    t.string('title', 255).notNullable();
    t.text('lead').notNullable();
    t.string('cta_label', 128).nullable();
    t.string('cta_href', 255).nullable();
    t.string('image', 512).nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('page_highlights', (t) => {
    t.increments('id').primary();
    t.string('page_key', 64).notNullable().index();
    t.string('highlight_key', 64).notNullable();
    t.string('label', 128).notNullable();
    t.string('value', 128).notNullable();
    t.string('note', 512).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('infra_inventory', (t) => {
    t.increments('id').primary();
    t.string('item_id', 64).notNullable().unique();
    t.string('category', 64).notNullable();
    t.string('category_label', 128).notNullable();
    t.text('description').notNullable();
    t.string('qty', 64).notNullable();
    t.string('unit', 64).notNullable().defaultTo('Nos');
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('projects', (t) => {
    t.increments('id').primary();
    t.string('project_id', 64).notNullable().unique();
    t.string('status', 32).notNullable().index(); // ongoing | completed
    t.string('region', 64).notNullable();
    t.string('region_label', 128).notNullable();
    t.string('sl_no', 32).notNullable();
    t.text('name').notNullable();
    t.string('patron', 512).nullable();
    t.string('value_lakhs', 64).notNullable();
    t.string('progress', 16).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('gallery_case_studies', (t) => {
    t.increments('id').primary();
    t.string('case_id', 64).notNullable().unique();
    t.string('category', 64).notNullable();
    t.string('category_label', 128).notNullable();
    t.string('category_filter_label', 128).nullable();
    t.string('title', 255).notNullable();
    t.string('full_title', 512).nullable();
    t.string('client', 255).nullable();
    t.string('value', 128).nullable();
    t.string('value_badge', 64).nullable();
    t.string('location', 255).nullable();
    t.text('scope').nullable();
    t.text('short_desc').nullable();
    t.text('description').nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('gallery_images', (t) => {
    t.increments('id').primary();
    t.integer('case_study_id').unsigned().notNullable()
      .references('id').inTable('gallery_case_studies').onDelete('CASCADE');
    t.string('url', 512).notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('fleet_assets', (t) => {
    t.increments('id').primary();
    t.string('key', 64).notNullable().unique();
    t.string('name', 255).notNullable();
    t.string('count', 64).notNullable();
    t.string('icon', 64).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('financial_sections', (t) => {
    t.increments('id').primary();
    t.string('key', 64).notNullable().unique();
    t.string('title', 255).notNullable();
    t.string('icon', 64).nullable();
    t.text('text').notNullable();
    t.string('currency', 64).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('financial_turnover_years', (t) => {
    t.increments('id').primary();
    t.string('year', 32).notNullable().unique();
    t.decimal('amount', 14, 2).notNullable();
    t.string('source', 32).notNullable().defaultTo('published');
    t.boolean('visible').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('team_photos', (t) => {
    t.increments('id').primary();
    t.string('photo_id', 64).notNullable().unique();
    t.string('url', 512).notNullable();
    t.string('caption', 512).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('inquiries', (t) => {
    t.increments('id').primary();
    t.string('inquiry_id', 64).notNullable().unique();
    t.string('name', 255).notNullable();
    t.string('company', 255).nullable();
    t.string('email', 255).notNullable();
    t.string('phone', 64).nullable();
    t.string('subject', 512).notNullable();
    t.text('message').notNullable();
    t.string('status', 32).notNullable().defaultTo('NEW');
    t.string('priority', 32).notNullable().defaultTo('MEDIUM');
    t.string('value', 128).nullable();
    t.timestamps(true, true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('inquiries');
  await knex.schema.dropTableIfExists('team_photos');
  await knex.schema.dropTableIfExists('financial_turnover_years');
  await knex.schema.dropTableIfExists('financial_sections');
  await knex.schema.dropTableIfExists('fleet_assets');
  await knex.schema.dropTableIfExists('gallery_images');
  await knex.schema.dropTableIfExists('gallery_case_studies');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('infra_inventory');
  await knex.schema.dropTableIfExists('page_highlights');
  await knex.schema.dropTableIfExists('page_content');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('admin_lockouts');
  await knex.schema.dropTableIfExists('admin_sessions');
  await knex.schema.dropTableIfExists('admin_users');
};
