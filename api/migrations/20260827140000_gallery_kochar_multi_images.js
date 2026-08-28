/**
 * Ensure Kochar Industrial Park case study has all 5 gallery images.
 * Older DBs / seeds may only have the single cover photo.
 */
exports.up = async function up(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-kochar' }).first();
  if (!study) return;

  const desired = [
    'kochar-warehouse.jpg',
    'kochar-entrance.png',
    'kochar-aerial.png',
    'kochar-warehouse-01.png',
    'kochar-warehouse-07.png'
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
