/**
 * Add DAE Type II-B residential quarters gallery case study
 * (DAE Township, Kalpakkam) — separate from IGCAR Engineering Hall V.
 */
exports.up = async function up(knex) {
  const images = ['dae-kalpakkam-type-iib-quarters.png'];

  let study = await knex('gallery_case_studies').where({ case_id: 'gallery-dae-quarters' }).first();

  if (!study) {
    const maxOrder = (await knex('gallery_case_studies').max('sort_order as m').first()).m || 0;
    const insertOrder = Number(maxOrder) + 1;

    await knex('gallery_case_studies').insert({
      case_id: 'gallery-dae-quarters',
      category: 'commercial',
      category_label: 'Residential Township',
      category_filter_label: 'Commercial',
      title: 'DAE Type II-B Quarters',
      full_title: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam [including electrical work]',
      client: 'Department of Atomic Energy (DAE)',
      value: '₹25.83 Crore',
      value_badge: '₹25.83 Cr',
      location: 'DAE Township, Kalpakkam, TN',
      scope: '116 Nos. Type II-B residential quarters including electrical work',
      short_desc: '116 Type II-B residential quarters with electrical works in DAE Township at Kalpakkam.',
      description: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam, including electrical work. The project delivered multi-storey township housing blocks with associated electrical installations for Department of Atomic Energy residential accommodation.',
      sort_order: insertOrder
    });
    study = await knex('gallery_case_studies').where({ case_id: 'gallery-dae-quarters' }).first();
  } else {
    await knex('gallery_case_studies').where({ id: study.id }).update({
      category: 'commercial',
      category_label: 'Residential Township',
      category_filter_label: 'Commercial',
      title: 'DAE Type II-B Quarters',
      full_title: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam [including electrical work]',
      client: 'Department of Atomic Energy (DAE)',
      value: '₹25.83 Crore',
      value_badge: '₹25.83 Cr',
      location: 'DAE Township, Kalpakkam, TN',
      scope: '116 Nos. Type II-B residential quarters including electrical work',
      short_desc: '116 Type II-B residential quarters with electrical works in DAE Township at Kalpakkam.',
      description: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam, including electrical work. The project delivered multi-storey township housing blocks with associated electrical installations for Department of Atomic Energy residential accommodation.'
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

  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({
      value: String((await knex('gallery_case_studies').count('id as c').first()).c || 11)
    });
};

exports.down = async function down(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-dae-quarters' }).first();
  if (study) {
    await knex('gallery_images').where({ case_study_id: study.id }).del();
    await knex('gallery_case_studies').where({ id: study.id }).del();
  }
  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({
      value: String((await knex('gallery_case_studies').count('id as c').first()).c || 10)
    });
};
