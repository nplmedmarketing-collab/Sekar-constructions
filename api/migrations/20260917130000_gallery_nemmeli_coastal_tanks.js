/**
 * Add coastal aerial + product tanks photos to 150 MLD Nemmeli SWRO gallery.
 */
exports.up = async function up(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-desal-150' }).first();
  if (!study) return;

  const desired = [
    'nemmeli-desal-coastal-aerial.png',
    'nemmeli-desal-tanks.png',
    'nemmeli-desalination.jpg',
    'nemmeli-desal-aerial.png',
    'nemmeli-desal-basins.png',
    'nemmeli-desal-civil-works.png'
  ];

  const existing = await knex('gallery_images')
    .where({ case_study_id: study.id })
    .orderBy('sort_order', 'asc');

  const existingUrls = existing.map((row) => String(row.url || '').trim());
  const missing = desired.filter((url) => !existingUrls.includes(url));
  if (!missing.length && existingUrls[0] === desired[0]) return;

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
  // Irreversible media backfill — no-op
};
