/**
 * Merge gallery-polyhose-peb back into gallery-polyhose (single Polyhose study).
 * Consolidates all six photos onto gallery-polyhose and removes the PEB-only row.
 */
exports.up = async function up(knex) {
  const mergedImages = [
    'polyhose-facility.png',
    'polyhose-foundation.png',
    'polyhose-facility-front.png',
    'polyhose-aerial-solar.png',
    'polyhose-warehouses-aerial.png',
    'polyhose-peb-warehouse.png'
  ];

  const factory = await knex('gallery_case_studies').where({ case_id: 'gallery-polyhose' }).first();
  const peb = await knex('gallery_case_studies').where({ case_id: 'gallery-polyhose-peb' }).first();

  if (factory) {
    await knex('gallery_case_studies').where({ id: factory.id }).update({
      category: 'industrial',
      category_label: 'Industrial Facility',
      category_filter_label: 'Industrial',
      title: 'Polyhose Factory & PEB Warehouse',
      full_title: 'Construction of Factory Buildings, Warehouses And Ancillary Buildings for Polyhose India, Irungattukottai',
      client: 'Polyhose India Pvt. Ltd.',
      value: '₹71.51 Crore',
      value_badge: '₹71.51 Cr',
      location: 'Irungattukottai, Chennai, TN',
      scope: 'Factory buildings, warehouses, PEB structure, ancillary buildings, plumbing',
      short_desc: 'Factory buildings, warehouses, PEB works, and ancillary buildings for Polyhose India at Irungattukottai.',
      description: 'Construction of proposed factory buildings, warehouse buildings including PEB works, and ancillary building works including plumbing for Polyhose India at Irungattukottai, Chennai. Scope covers structural framing, machinery foundations, PEB steel framing and cladding, interior flooring, utility integration, and external service pathways across the industrial campus.'
    });

    await knex('gallery_images').where({ case_study_id: factory.id }).del();
    await knex('gallery_images').insert(
      mergedImages.map((url, imgIdx) => ({
        case_study_id: factory.id,
        url,
        sort_order: imgIdx
      }))
    );
  }

  if (peb) {
    await knex('gallery_images').where({ case_study_id: peb.id }).del();
    await knex('gallery_case_studies').where({ id: peb.id }).del();
  }

  await knex('page_highlights')
    .where({ page_key: 'gallery', highlight_key: 'studies' })
    .update({ value: '8' });
};

exports.down = async function down() {
  // Irreversible content merge — no-op
};
