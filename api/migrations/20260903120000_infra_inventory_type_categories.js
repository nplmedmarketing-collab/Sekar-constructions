/**
 * Retag seed infrastructure inventory from the catch-all `own-equipments`
 * category into typed categories (machinery, scaffolding, heavy, etc.).
 *
 * Only remaps rows still tagged `own-equipments` so admin-customized
 * categories are left alone. Matches stable seed item_ids infra-1..infra-44.
 */
exports.up = async function up(knex) {
  const map = {
    'infra-1': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-2': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-3': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-4': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-5': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-6': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-7': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-8': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-9': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-10': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-11': { category: 'vehicles', category_label: 'Vehicles & Transport' },
    'infra-12': { category: 'vehicles', category_label: 'Vehicles & Transport' },
    'infra-13': { category: 'vehicles', category_label: 'Vehicles & Transport' },
    'infra-14': { category: 'vehicles', category_label: 'Vehicles & Transport' },
    'infra-15': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-16': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-17': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-18': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-19': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-20': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-21': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-22': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-23': { category: 'scaffolding', category_label: 'Scaffolding & Formwork' },
    'infra-24': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-25': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-26': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-27': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-28': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-29': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-30': { category: 'instruments', category_label: 'Site Instruments' },
    'infra-31': { category: 'instruments', category_label: 'Site Instruments' },
    'infra-32': { category: 'instruments', category_label: 'Site Instruments' },
    'infra-33': { category: 'heavy', category_label: 'Lifting & Excavation' },
    'infra-34': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-35': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-36': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-37': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-38': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-39': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-40': { category: 'quarry', category_label: 'Quarry & Crushing' },
    'infra-41': { category: 'machinery', category_label: 'Concrete Machinery' },
    'infra-42': { category: 'quarry', category_label: 'Quarry & Crushing' },
    'infra-43': { category: 'quarry', category_label: 'Quarry & Crushing' },
    'infra-44': { category: 'quarry', category_label: 'Quarry & Crushing' },
  };

  for (const [itemId, fields] of Object.entries(map)) {
    await knex('infra_inventory')
      .where({ item_id: itemId, category: 'own-equipments' })
      .update({
        category: fields.category,
        category_label: fields.category_label,
      });
  }
};

exports.down = async function down(knex) {
  const itemIds = Array.from({ length: 44 }, (_, i) => `infra-${i + 1}`);
  await knex('infra_inventory')
    .whereIn('item_id', itemIds)
    .whereIn('category', [
      'machinery',
      'scaffolding',
      'heavy',
      'vehicles',
      'instruments',
      'quarry',
    ])
    .update({
      category: 'own-equipments',
      category_label: 'Own Equipments',
    });
};
