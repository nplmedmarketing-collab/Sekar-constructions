const bcrypt = require('bcryptjs');
const defaults = require('../src/data/defaults');

const BCRYPT_ROUNDS = 12;

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error(
      '[seed] ABORTED: Running seeds in production wipes live CMS tables. To force seeding in production, set ALLOW_PRODUCTION_SEED=true.'
    );
  }

  // Read existing admin users before clearing tables so custom passwords & 2FA are preserved
  const existingUsers = await knex('admin_users').select('*');

  // Clear in FK-safe order
  await knex('gallery_images').del();
  await knex('gallery_case_studies').del();
  await knex('projects').del();
  await knex('infra_inventory').del();
  await knex('page_highlights').del();
  await knex('page_content').del();
  await knex('fleet_assets').del();
  await knex('financial_turnover_years').del();
  await knex('financial_sections').del();
  await knex('team_photos').del();
  await knex('gallery_media_items').del();
  await knex('inquiries').del();
  await knex('audit_logs').del();
  await knex('admin_sessions').del();
  await knex('admin_lockouts').del();
  try {
    await knex('login_challenges').del();
  } catch {
    /* migration may not have run yet */
  }
  try {
    await knex('admin_backup_codes').del();
  } catch {
    /* optional table */
  }
  await knex('admin_users').del();

  const username = process.env.SEED_ADMIN_USERNAME || defaults.LOCAL_ADMIN.username;
  const isProd = process.env.NODE_ENV === 'production';

  const existingSuperAdmin = existingUsers.find((u) => u.username === username);

  if (existingSuperAdmin && !process.env.FORCE_RESET_ADMIN_PASSWORD) {
    await knex('admin_users').insert(existingSuperAdmin);
    console.log(`[seed] Preserved existing admin user account for '${username}' (custom password preserved).`);
  } else {
    let password = process.env.SEED_ADMIN_PASSWORD;
    if (isProd && !password) {
      throw new Error(
        '[seed] Production seed hard-fails because SEED_ADMIN_PASSWORD is not set. You must set SEED_ADMIN_PASSWORD in environment variables before seeding.'
      );
    }

    if (!password) {
      const crypto = require('crypto');
      password = `DevPass-${crypto.randomBytes(12).toString('hex')}`;
      console.log('');
      console.log('============================================================');
      console.log(`[seed] Generated admin password for '${username}':`);
      console.log(`        ${password}`);
      console.log('============================================================');
      console.log('[seed] Save this password — it will not be shown again.');
      console.log('');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await knex('admin_users').insert({
      username,
      password_hash: passwordHash,
      must_change_password: true,
      totp_enabled: false,
    });
  }

  // Re-insert any additional custom admin users
  for (const otherUser of existingUsers) {
    if (otherUser.username !== username) {
      await knex('admin_users').insert(otherUser);
    }
  }

  await knex('audit_logs').insert({
    event: 'SYSTEM_SEEDED',
    details: 'Database seeded with default CMS content. Admin must change password on first login.',
    level: 'INFO',
    ip: '127.0.0.1',
  });

  async function insertPage(pageKey, hero, highlights) {
    await knex('page_content').insert({
      page_key: pageKey,
      brand: hero.brand,
      title: hero.title,
      lead: hero.lead,
      cta_label: hero.ctaLabel,
      cta_href: hero.ctaHref,
      image: hero.image,
    });
    await knex('page_highlights').insert(
      highlights.map((h, i) => ({
        page_key: pageKey,
        highlight_key: h.key,
        label: h.label,
        value: h.value,
        note: h.note,
        sort_order: i,
      }))
    );
  }

  await insertPage('infrastructure', defaults.infrastructure.hero, defaults.infrastructure.highlights);
  await knex('infra_inventory').insert(
    defaults.infrastructure.inventory.map((row, i) => ({
      item_id: row.id,
      category: row.category,
      category_label: row.categoryLabel,
      description: row.description,
      qty: row.qty,
      unit: row.unit,
      sort_order: i,
    }))
  );

  await insertPage('ongoing', defaults.ongoing.hero, defaults.ongoing.highlights);
  await knex('projects').insert(
    defaults.ongoing.projects.map((p, i) => ({
      project_id: p.id,
      status: 'ongoing',
      region: p.region,
      region_label: p.regionLabel,
      sl_no: p.slNo,
      name: p.name,
      patron: p.patron,
      value_lakhs: p.valueLakhs,
      progress: p.progress,
      sort_order: i,
    }))
  );

  await insertPage('completed', defaults.completed.hero, defaults.completed.highlights);
  await knex('projects').insert(
    defaults.completed.projects.map((p, i) => ({
      project_id: p.id,
      status: 'completed',
      region: p.region,
      region_label: p.regionLabel,
      sl_no: p.slNo,
      name: p.name,
      patron: null,
      value_lakhs: p.valueLakhs,
      progress: null,
      sort_order: i,
    }))
  );

  await insertPage('gallery', defaults.gallery.hero, defaults.gallery.highlights);
  for (let i = 0; i < defaults.gallery.items.length; i += 1) {
    const item = defaults.gallery.items[i];
    await knex('gallery_case_studies').insert({
      case_id: item.id,
      category: item.category,
      category_label: item.categoryLabel,
      category_filter_label: item.category === 'infrastructure' ? 'Infrastructure'
        : item.category === 'industrial' ? 'Industrial'
          : item.category === 'commercial' ? 'Commercial' : item.categoryLabel,
      title: item.title,
      full_title: item.fullTitle,
      client: item.client,
      value: item.value,
      value_badge: item.valueBadge,
      location: item.location,
      scope: item.scope,
      short_desc: item.shortDesc,
      description: item.description,
      sort_order: i,
    });
    const study = await knex('gallery_case_studies').where({ case_id: item.id }).first();
    const images = item.images && item.images.length ? item.images : [item.image];
    await knex('gallery_images').insert(
      images.map((url, imgIdx) => ({
        case_study_id: study.id,
        url,
        sort_order: imgIdx,
      }))
    );
  }

  await knex('fleet_assets').insert(
    defaults.fleet.map((f, i) => ({
      key: f.key,
      name: f.name,
      count: f.count,
      icon: f.icon,
      sort_order: i,
    }))
  );

  await knex('financial_sections').insert(
    defaults.financials.map((f, i) => ({
      key: f.key,
      title: f.title,
      icon: f.icon,
      text: f.text,
      currency: f.currency || null,
      sort_order: i,
    }))
  );

  await knex('financial_turnover_years').insert(
    defaults.turnoverSeries.map((row, i) => ({
      year: row.year,
      amount: row.amount,
      source: row.source,
      visible: row.visible,
      sort_order: i,
    }))
  );

  await knex('team_photos').insert(
    defaults.teamPhotos.map((p, i) => ({
      photo_id: p.id,
      url: p.url,
      caption: p.caption,
      sort_order: i,
    }))
  );

  const media = defaults.galleryMedia || {};
  const mediaRows = [];
  ['plant_machinery', 'founder_clients', 'certificates', 'founder_logos'].forEach((section) => {
    const list = Array.isArray(media[section]) ? media[section] : [];
    list.forEach((item, i) => {
      mediaRows.push({
        item_id: item.id,
        section,
        url: item.url,
        title: item.title || null,
        badge: item.badge || null,
        badge_icon: item.badgeIcon || null,
        location: item.location || null,
        location_icon: item.locationIcon || null,
        description: item.description || null,
        author: item.author || null,
        quote: item.quote || null,
        meta_json: item.meta ? JSON.stringify(item.meta) : null,
        sort_order: i,
      });
    });
  });
  if (mediaRows.length) {
    await knex('gallery_media_items').insert(mediaRows);
  }

  if (defaults.sampleInquiries.length) {
    const now = new Date();
    await knex('inquiries').insert(
      defaults.sampleInquiries.map((inq) => ({
        inquiry_id: inq.id,
        name: inq.name,
        company: inq.company,
        email: inq.email,
        phone: inq.phone,
        subject: inq.subject,
        message: inq.message,
        status: inq.status,
        priority: inq.priority,
        value: inq.value,
        created_at: now,
        updated_at: now,
      }))
    );
  }
};
