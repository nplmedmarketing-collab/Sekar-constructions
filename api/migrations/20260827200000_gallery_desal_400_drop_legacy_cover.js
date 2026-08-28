/**
 * Drop legacy cover desalination-plant.jpg from gallery-desal-400 carousel.
 * Keeps the 8 desal-400-*.png slides; first image remains the cover.
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
  // Irreversible data trim — no-op
};
