/**
 * Ensure 150 MLD Nemmeli desalination case study has all gallery images
 * and refreshed civil-works title/meta. Older DBs may only have the cover.
 */
exports.up = async function up(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-desal-150' }).first();
  if (!study) return;

  const desired = [
    'nemmeli-desalination.jpg',
    'nemmeli-desal-aerial.png',
    'nemmeli-desal-basins.png',
    'nemmeli-desal-civil-works.png'
  ];

  await knex('gallery_case_studies').where({ id: study.id }).update({
    title: '150 MLD Nemmeli SWRO Plant',
    full_title: 'Construction of Civil work at 150 MLD SWRO Desalination plant at ECR, Nemmeli, Chennai on behalf of Cobratecton Private Limited.',
    short_desc: 'Civil works for the 150 MLD SWRO desalination plant at ECR, Nemmeli on behalf of Cobratecton Private Limited.',
    description: 'Execution of civil engineering works for the 150 MLD Seawater Reverse Osmosis (SWRO) desalination plant at ECR, Nemmeli, Chennai on behalf of Cobratecton Private Limited. The project involved constructing robust structural concrete systems, massive water storage basins, and foundations for processing machinery under strict marine environmental specifications.'
  });

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
