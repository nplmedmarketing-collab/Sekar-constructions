/**
 * Drop near-duplicate courtyard slide from gallery-great-lakes.
 * Cover (great-lakes-campus.jpg) already shows the same courtyard view.
 */
exports.up = async function up(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-great-lakes' }).first();
  if (!study) return;

  const desired = [
    'great-lakes-campus.jpg',
    'great-lakes-entrance.png',
    'great-lakes-building.png',
    'great-lakes-hostel-court.png'
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
