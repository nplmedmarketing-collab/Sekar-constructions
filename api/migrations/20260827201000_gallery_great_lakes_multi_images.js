/**
 * Ensure Great Lakes Institute of Management Campus case study has all
 * gallery images and refreshed full title. Older DBs may only have the cover.
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

  await knex('gallery_case_studies').where({ id: study.id }).update({
    title: 'Great Lakes Campus',
    full_title: 'Construction of Great Lakes Institute of Management Campus at Manamai',
    short_desc: 'Academic block, hostel, utility systems, STP, and landscaping for the premier management campus at Manamai.',
    description: 'Construction of the main campus facilities for the Great Lakes Institute of Management at Manamai. The project included structural and finishing works for the academic block, student hostel blocks, warehouse, canteen, electric sub-station, library, plumbing works, sewage treatment plant, and comprehensive site development.'
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
