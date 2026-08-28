/**
 * Remove NPCIL Emergency Support Centre gallery case study
 * and its matching certificates media item (if present).
 *
 * @param { import('knex').Knex } knex
 */
exports.up = async function up(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-npcil-oesc' }).first();
  if (study) {
    await knex('gallery_images').where({ case_study_id: study.id }).del();
    await knex('gallery_case_studies').where({ id: study.id }).del();
  }

  if (await knex.schema.hasTable('gallery_media_items')) {
    await knex('gallery_media_items').where({ item_id: 'cert-npcil-oesc' }).del();
  }

  const countRow = await knex('gallery_case_studies').count({ c: '*' }).first();
  const count = Number(countRow && (countRow.c ?? countRow['count(*)']) || 0);
  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({ value: String(count || 11) });
};

exports.down = async function down() {
  // Intentionally not restored — content was removed from defaults by request.
};
