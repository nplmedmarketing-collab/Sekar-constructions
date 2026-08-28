/**
 * Add ISRO C25 Stage Integration Complex gallery case study
 * (IPRC Mahendragiri) with three site photographs.
 */
exports.up = async function up(knex) {
  const images = [
    'isro-c25-integration-exterior.png',
    'isro-c25-facade.png',
    'isro-clean-room-interior.png'
  ];

  let study = await knex('gallery_case_studies').where({ case_id: 'gallery-isro-c25' }).first();

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
      case_id: 'gallery-isro-c25',
      category: 'industrial',
      category_label: 'Aerospace / Institutional',
      category_filter_label: 'Industrial',
      title: 'ISRO C25 Integration Complex',
      full_title: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri',
      client: 'Indian Space Research Organisation (ISRO)',
      value: '₹56.30 Crore',
      value_badge: '₹56.30 Cr',
      location: 'IPRC, Mahendragiri, TN',
      scope: 'C25 Stage Integration Complex, 1,00,000 CUM clean room, civil, PH, storm water drains, mechanical doors, area development',
      short_desc: 'C25 Stage Integration Complex with 1,00,000 CUM clean room and area development works at IPRC, Mahendragiri.',
      description: 'Construction of the C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri for the ISRO Propulsion Complex. Scope included civil works, public health, storm water drains, mechanical doors, and a 1,00,000 CUM capacity clean room for stage integration.',
      sort_order: insertOrder
    });
    study = await knex('gallery_case_studies').where({ case_id: 'gallery-isro-c25' }).first();
  } else {
    await knex('gallery_case_studies').where({ id: study.id }).update({
      category: 'industrial',
      category_label: 'Aerospace / Institutional',
      category_filter_label: 'Industrial',
      title: 'ISRO C25 Integration Complex',
      full_title: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri',
      client: 'Indian Space Research Organisation (ISRO)',
      value: '₹56.30 Crore',
      value_badge: '₹56.30 Cr',
      location: 'IPRC, Mahendragiri, TN',
      scope: 'C25 Stage Integration Complex, 1,00,000 CUM clean room, civil, PH, storm water drains, mechanical doors, area development',
      short_desc: 'C25 Stage Integration Complex with 1,00,000 CUM clean room and area development works at IPRC, Mahendragiri.',
      description: 'Construction of the C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri for the ISRO Propulsion Complex. Scope included civil works, public health, storm water drains, mechanical doors, and a 1,00,000 CUM capacity clean room for stage integration.'
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
    .update({ value: '9' });
};

exports.down = async function down(knex) {
  const study = await knex('gallery_case_studies').where({ case_id: 'gallery-isro-c25' }).first();
  if (study) {
    await knex('gallery_images').where({ case_study_id: study.id }).del();
    await knex('gallery_case_studies').where({ id: study.id }).del();
  }
  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({ value: '8' });
};
