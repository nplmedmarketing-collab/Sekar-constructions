/**
 * Gallery submenu media CMS schema.
 * Seeds current static content from defaults.js.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('gallery_media_items', (t) => {
    t.increments('id').primary();
    t.string('item_id', 64).notNullable().unique();
    t.string('section', 64).notNullable().index();
    t.text('url').notNullable();
    t.string('title', 512).nullable();
    t.string('badge', 255).nullable();
    t.string('badge_icon', 64).nullable();
    t.string('location', 512).nullable();
    t.string('location_icon', 64).nullable();
    t.text('description').nullable();
    t.text('author').nullable();
    t.text('quote').nullable();
    t.text('meta_json').nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  const defaults = require('../src/data/defaults');
  const media = defaults.galleryMedia || {};
  const sections = ['plant_machinery', 'founder_clients', 'certificates', 'founder_logos'];
  const rows = [];

  sections.forEach((section) => {
    const list = Array.isArray(media[section]) ? media[section] : [];
    list.forEach((item, i) => {
      rows.push({
        item_id: item.id,
        section,
        url: item.url,
        title: item.title || null,
        badge: item.badge || null,
        badge_icon: item.badgeIcon || null,
        location: item.location || null,
        location_icon: item.locationIcon || null,
        description: item.description || null,
        author: item.author || null,
        quote: item.quote || null,
        meta_json: item.meta ? JSON.stringify(item.meta) : null,
        sort_order: i,
      });
    });
  });

  if (rows.length) {
    await knex('gallery_media_items').insert(rows);
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('gallery_media_items');
};
