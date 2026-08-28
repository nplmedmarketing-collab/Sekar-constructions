/**
 * Ensure Polyhose E25 Factory case study has all 6 gallery images.
 * Older DBs / seeds may only have the single cover photo.
 */
exports.up = async function up(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-polyhose' }).first();
  if (!study) return;

  const desired = [
    'polyhose-facility.png',
    'polyhose-foundation.png',
    'polyhose-facility-front.png',
    'polyhose-aerial-solar.png',
    'polyhose-warehouses-aerial.png',
    'polyhose-peb-warehouse.png'
  ];

  const existing = await knex('gallery_images')
    .where({ case_study_id: study.id })
    .orderBy('sort_order', 'asc');

  if (existing.length >= desired.length) return;

  await knex('gallery_images').where({ case_study_id: study.id }).del();
  await knex('gallery_images').insert(
    desired.map((url, imgIdx) => ({
      case_study_id: study.id,
      url,
      sort_order: imgIdx
    }))
  );
};

exports.down = async function down() {
  // Irreversible data backfill — no-op
};
