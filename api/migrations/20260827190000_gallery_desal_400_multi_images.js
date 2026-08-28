/**
 * Ensure 400 MLD CMWSSB desalination case study has all gallery images
 * and refreshed title/meta. Older DBs may only have the single cover.
 */
exports.up = async function up(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-desal-400' }).first();
  if (!study) return;

  const desired = [
    'desal-400-site-aerial.png',
    'desal-400-excavation.png',
    'desal-400-foundation.png',
    'desal-400-concrete-pour.png',
    'desal-400-circular-tank.png',
    'desal-400-clarifiers.png',
    'desal-400-reservoir.png',
    'desal-400-coastal-basins.png'
  ];

  await knex('gallery_case_studies').where({ id: study.id }).update({
    title: '400 MLD Desalination Plant',
    full_title: 'Construction of 400 MLD Desalination Plant for CMWSSB',
    short_desc: 'Marine-grade concrete process basins, intake structures, and pump house civil works for CMWSSB along ECR.',
    description: 'Executed marine-grade concrete containment basins and processing structures for the 400 MLD Seawater Reverse Osmosis (SWRO) desalination facility for CMWSSB. Used highly resilient anti-corrosive concrete mixes to withstand high-salinity environment and coastal elements.'
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
