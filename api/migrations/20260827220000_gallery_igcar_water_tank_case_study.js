/**
 * Add IGCAR elevated water tank gallery case study (Kalpakkam).
 * Separate from gallery-igcar-hall-v and gallery-dae-quarters.
 */
exports.up = async function up(knex) {
  const images = ['igcar-water-tank.png'];

  let study = await knex('gallery_case_studies').where({ case_id: 'gallery-igcar-water-tank' }).first();

  if (!study) {
    const anchor = await knex('gallery_case_studies')
      .where({ case_id: 'gallery-great-lakes' })
      .first();
    const insertOrder = anchor
      ? Number(anchor.sort_order)
      : ((await knex('gallery_case_studies').max('sort_order as m').first()).m || 0) + 1;

    if (anchor) {
      await knex('gallery_case_studies')
        .where('sort_order', '>=', insertOrder)
        .increment('sort_order', 1);
    }

    await knex('gallery_case_studies').insert({
      case_id: 'gallery-igcar-water-tank',
      category: 'infrastructure',
      category_label: 'Water Utilities',
      category_filter_label: 'Infrastructure',
      title: 'IGCAR Water Tank',
      full_title: 'Construction of Water Tanker 4.5Lakhs Capacity 18m Height at IGCAR, Kalpakkam',
      client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
      value: '',
      value_badge: '',
      location: 'IGCAR, Kalpakkam, TN',
      scope: 'Elevated water tank, 4.5 lakh litre capacity, 18 m height',
      short_desc: '4.5 lakh litre capacity elevated water tank (18 m height) under construction at IGCAR, Kalpakkam.',
      description: 'Construction of an elevated water tank of 4.5 lakh litre capacity and 18 m height at IGCAR, Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).',
      sort_order: insertOrder
    });
    study = await knex('gallery_case_studies').where({ case_id: 'gallery-igcar-water-tank' }).first();
  } else {
    await knex('gallery_case_studies').where({ id: study.id }).update({
      category: 'infrastructure',
      category_label: 'Water Utilities',
      category_filter_label: 'Infrastructure',
      title: 'IGCAR Water Tank',
      full_title: 'Construction of Water Tanker 4.5Lakhs Capacity 18m Height at IGCAR, Kalpakkam',
      client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
      value: '',
      value_badge: '',
      location: 'IGCAR, Kalpakkam, TN',
      scope: 'Elevated water tank, 4.5 lakh litre capacity, 18 m height',
      short_desc: '4.5 lakh litre capacity elevated water tank (18 m height) under construction at IGCAR, Kalpakkam.',
      description: 'Construction of an elevated water tank of 4.5 lakh litre capacity and 18 m height at IGCAR, Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).'
    });
  }

  if (study) {
    await knex('gallery_images').where({ case_study_id: study.id }).del();
    await knex('gallery_images').insert(
      images.map((url, imgIdx) => ({
        case_study_id: study.id,
        url,
        sort_order: imgIdx
      }))
    );
  }

  const countRow = await knex('gallery_case_studies').count({ c: '*' }).first();
  const count = Number(countRow && (countRow.c != null ? countRow.c : countRow['count(*)'])) || 0;
  if (count > 0) {
    await knex('page_highlights')
      .where({ page_key: 'gallery', highlight_key: 'studies' })
      .update({ value: String(count) });
  }
};

exports.down = async function down(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-igcar-water-tank' }).first();
  if (study) {
    await knex('gallery_images').where({ case_study_id: study.id }).del();
    await knex('gallery_case_studies').where({ id: study.id }).del();
  }
  const countRow = await knex('gallery_case_studies').count({ c: '*' }).first();
  const count = Number(countRow && (countRow.c != null ? countRow.c : countRow['count(*)'])) || 0;
  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({ value: String(count) });
};
