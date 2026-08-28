/**
 * Add IGCAR Engineering Hall V gallery case study (Kalpakkam).
 */
exports.up = async function up(knex) {
  const images = ['igcar-engineering-hall-v.png'];

  let study = await knex('gallery_case_studies').where({ case_id: 'gallery-igcar-hall-v' }).first();

  if (!study) {
    const greatLakes = await knex('gallery_case_studies')
      .where({ case_id: 'gallery-great-lakes' })
      .first();
    const insertOrder = greatLakes
      ? Number(greatLakes.sort_order)
      : ((await knex('gallery_case_studies').max('sort_order as m').first()).m || 0) + 1;

    if (greatLakes) {
      await knex('gallery_case_studies')
        .where('sort_order', '>=', insertOrder)
        .increment('sort_order', 1);
    }

    await knex('gallery_case_studies').insert({
      case_id: 'gallery-igcar-hall-v',
      category: 'industrial',
      category_label: 'Nuclear / Institutional',
      category_filter_label: 'Industrial',
      title: 'IGCAR Engineering Hall V',
      full_title: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam',
      client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
      value: '₹36.55 Crore',
      value_badge: '₹36.55 Cr',
      location: 'IGCAR, Kalpakkam, TN',
      scope: 'Engineering Hall – V civil construction',
      short_desc: 'Engineering Hall – V civil construction for IGCAR at Kalpakkam.',
      description: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).',
      sort_order: insertOrder
    });
    study = await knex('gallery_case_studies').where({ case_id: 'gallery-igcar-hall-v' }).first();
  } else {
    await knex('gallery_case_studies').where({ id: study.id }).update({
      category: 'industrial',
      category_label: 'Nuclear / Institutional',
      category_filter_label: 'Industrial',
      title: 'IGCAR Engineering Hall V',
      full_title: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam',
      client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
      value: '₹36.55 Crore',
      value_badge: '₹36.55 Cr',
      location: 'IGCAR, Kalpakkam, TN',
      scope: 'Engineering Hall – V civil construction',
      short_desc: 'Engineering Hall – V civil construction for IGCAR at Kalpakkam.',
      description: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).'
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
  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({ value: String(countRow.c || 10) });
};

exports.down = async function down(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-igcar-hall-v' }).first();
  if (study) {
    await knex('gallery_images').where({ case_study_id: study.id }).del();
    await knex('gallery_case_studies').where({ id: study.id }).del();
  }
  const countRow = await knex('gallery_case_studies').count({ c: '*' }).first();
  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({ value: String(countRow.c || 9) });
};
