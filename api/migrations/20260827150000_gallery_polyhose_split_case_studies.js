/**
 * Split Polyhose into two case studies and reassign gallery images.
 * Study A (gallery-polyhose): factory / warehouses / ancillary.
 * Study B (gallery-polyhose-peb): warehouse including PEB works.
 */
exports.up = async function up(knex) {
  const factoryImages = [
    'polyhose-facility.png',
    'polyhose-foundation.png',
    'polyhose-facility-front.png',
    'polyhose-aerial-solar.png'
  ];
  const pebImages = [
    'polyhose-peb-warehouse.png',
    'polyhose-warehouses-aerial.png'
  ];

  const factory = await knex('gallery_case_studies').where({ case_id: 'gallery-polyhose' }).first();
  if (factory) {
    await knex('gallery_case_studies').where({ id: factory.id }).update({
      category: 'industrial',
      category_label: 'Industrial Facility',
      category_filter_label: 'Industrial',
      title: 'Polyhose Factory Buildings',
      full_title: 'Construction of Factory Buildings, Warehouses And Ancillary Buildings for Polyhose India, Irungattukottai',
      client: 'Polyhose India Pvt. Ltd.',
      value: '₹71.51 Crore',
      value_badge: '₹71.51 Cr',
      location: 'Irungattukottai, Chennai, TN',
      scope: 'Factory buildings, warehouses, ancillary buildings, plumbing',
      short_desc: 'Factory buildings, warehouses, and ancillary works for Polyhose India at Irungattukottai.',
      description: 'Construction of proposed factory buildings, warehouse buildings, and ancillary building works including plumbing for Polyhose India at Irungattukottai, Chennai. Scope covers structural framing, machinery foundations, interior flooring, utility integration, and external service pathways across the industrial campus.'
    });
    await knex('gallery_images').where({ case_study_id: factory.id }).del();
    await knex('gallery_images').insert(
      factoryImages.map((url, imgIdx) => ({
        case_study_id: factory.id,
        url,
        sort_order: imgIdx
      }))
    );
  }

  let peb = await knex('gallery_case_studies').where({ case_id: 'gallery-polyhose-peb' }).first();
  if (!peb) {
    const afterFactory = factory
      ? Number(factory.sort_order) + 1
      : (await knex('gallery_case_studies').max('sort_order as m').first()).m || 0;

    // Shift following studies so the PEB card sits beside the factory study.
    await knex('gallery_case_studies')
      .where('sort_order', '>=', afterFactory)
      .increment('sort_order', 1);

    await knex('gallery_case_studies').insert({
      case_id: 'gallery-polyhose-peb',
      category: 'industrial',
      category_label: 'PEB Warehouse',
      category_filter_label: 'Industrial',
      title: 'Polyhose PEB Warehouse',
      full_title: 'Construction of Warehouse including PEB Works for Polyhose India, Irungattukottai',
      client: 'Polyhose India Pvt. Ltd.',
      value: '',
      value_badge: '',
      location: 'Irungattukottai, Chennai, TN',
      scope: 'Warehouse construction including PEB structure erection',
      short_desc: 'Warehouse construction including Pre-Engineered Building (PEB) works for Polyhose India at Irungattukottai.',
      description: 'Construction of warehouse facilities including Pre-Engineered Building (PEB) works for Polyhose India at Irungattukottai. Scope covers PEB steel framing and cladding, large-span warehouse halls, and associated site works.',
      sort_order: afterFactory
    });
    peb = await knex('gallery_case_studies').where({ case_id: 'gallery-polyhose-peb' }).first();
  } else {
    await knex('gallery_case_studies').where({ id: peb.id }).update({
      category: 'industrial',
      category_label: 'PEB Warehouse',
      category_filter_label: 'Industrial',
      title: 'Polyhose PEB Warehouse',
      full_title: 'Construction of Warehouse including PEB Works for Polyhose India, Irungattukottai',
      client: 'Polyhose India Pvt. Ltd.',
      value: '',
      value_badge: '',
      location: 'Irungattukottai, Chennai, TN',
      scope: 'Warehouse construction including PEB structure erection',
      short_desc: 'Warehouse construction including Pre-Engineered Building (PEB) works for Polyhose India at Irungattukottai.',
      description: 'Construction of warehouse facilities including Pre-Engineered Building (PEB) works for Polyhose India at Irungattukottai. Scope covers PEB steel framing and cladding, large-span warehouse halls, and associated site works.'
    });
  }

  if (peb) {
    await knex('gallery_images').where({ case_study_id: peb.id }).del();
    await knex('gallery_images').insert(
      pebImages.map((url, imgIdx) => ({
        case_study_id: peb.id,
        url,
        sort_order: imgIdx
      }))
    );
  }

  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({ value: '9' });
};

exports.down = async function down() {
  // Irreversible content split — no-op
};
