const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { assertAllowedCtaHref, isAllowedCmsImageSrc } = require('../utils/safeUrl');

async function getHeroAndHighlights(pageKey) {
  const heroRow = await db('page_content').where({ page_key: pageKey }).first();
  if (!heroRow) return null;
  const highlights = await db('page_highlights')
    .where({ page_key: pageKey })
    .orderBy('sort_order', 'asc');
  return {
    hero: {
      brand: heroRow.brand,
      title: heroRow.title,
      lead: heroRow.lead,
      ctaLabel: heroRow.cta_label,
      ctaHref: heroRow.cta_href,
      image: heroRow.image,
    },
    highlights: highlights.map((h) => ({
      key: h.highlight_key,
      label: h.label,
      value: h.value,
      note: h.note,
    })),
  };
}

async function upsertPageMeta(pageKey, hero, highlights) {
  assertAllowedCtaHref(hero && hero.ctaHref);
  if (hero && hero.image != null && hero.image !== '' && !isAllowedCmsImageSrc(hero.image)) {
    const err = new Error('Invalid hero image URL.');
    err.status = 400;
    err.code = 'INVALID_IMAGE';
    throw err;
  }
  const existing = await db('page_content').where({ page_key: pageKey }).first();
  const payload = {
    brand: hero.brand,
    title: hero.title,
    lead: hero.lead,
    cta_label: hero.ctaLabel,
    cta_href: hero.ctaHref,
    image: hero.image,
    updated_at: db.fn.now(),
  };
  if (existing) {
    await db('page_content').where({ page_key: pageKey }).update(payload);
  } else {
    await db('page_content').insert({ page_key: pageKey, ...payload });
  }
  await db('page_highlights').where({ page_key: pageKey }).del();
  if (Array.isArray(highlights) && highlights.length) {
    await db('page_highlights').insert(
      highlights.slice(0, 3).map((h, i) => ({
        page_key: pageKey,
        highlight_key: h.key || `h${i}`,
        label: String(h.label || ''),
        value: String(h.value || ''),
        note: String(h.note || ''),
        sort_order: i,
      }))
    );
  }
}

async function getInfrastructure() {
  const base = await getHeroAndHighlights('infrastructure');
  if (!base) return null;
  const inventory = await db('infra_inventory').orderBy('sort_order', 'asc');
  return {
    ...base,
    inventory: inventory.map((row) => ({
      id: row.item_id,
      category: row.category,
      categoryLabel: row.category_label,
      description: row.description,
      qty: row.qty,
      unit: row.unit,
    })),
  };
}

async function putInfrastructure(data) {
  await upsertPageMeta('infrastructure', data.hero, data.highlights);
  await db('infra_inventory').del();
  const inventory = Array.isArray(data.inventory) ? data.inventory : [];
  if (inventory.length) {
    await db('infra_inventory').insert(
      inventory.map((row, i) => ({
        item_id: row.id || `infra-${i + 1}-${Date.now()}`,
        category: row.category,
        category_label: row.categoryLabel || row.category,
        description: row.description,
        qty: String(row.qty ?? ''),
        unit: row.unit || 'Nos',
        sort_order: i,
      }))
    );
  }
  return getInfrastructure();
}

async function getProjectsPage(status) {
  const pageKey = status === 'ongoing' ? 'ongoing' : 'completed';
  const base = await getHeroAndHighlights(pageKey);
  if (!base) return null;
  const projects = await db('projects').where({ status }).orderBy('sort_order', 'asc');
  return {
    ...base,
    projects: projects.map((p) => {
      const row = {
        id: p.project_id,
        region: p.region,
        regionLabel: p.region_label,
        slNo: p.sl_no,
        name: p.name,
        valueLakhs: p.value_lakhs,
      };
      if (status === 'ongoing') {
        row.patron = p.patron;
        row.progress = p.progress;
      }
      return row;
    }),
  };
}

async function putProjectsPage(status, data) {
  const pageKey = status === 'ongoing' ? 'ongoing' : 'completed';
  await upsertPageMeta(pageKey, data.hero, data.highlights);
  await db('projects').where({ status }).del();
  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (projects.length) {
    await db('projects').insert(
      projects.map((p, i) => ({
        project_id: p.id || `${status}-${i + 1}-${Date.now()}`,
        status,
        region: p.region,
        region_label: p.regionLabel || p.region,
        sl_no: String(p.slNo ?? i + 1),
        name: p.name,
        patron: status === 'ongoing' ? (p.patron || null) : null,
        value_lakhs: String(p.valueLakhs ?? ''),
        progress: status === 'ongoing' ? String(p.progress ?? '0') : null,
        sort_order: i,
      }))
    );
  }
  return getProjectsPage(status);
}

async function getGallery() {
  const base = await getHeroAndHighlights('gallery');
  if (!base) return null;
  const studies = await db('gallery_case_studies').orderBy('sort_order', 'asc');
  const items = [];
  for (const s of studies) {
    const images = await db('gallery_images')
      .where({ case_study_id: s.id })
      .orderBy('sort_order', 'asc');
    const urls = images.map((img) => img.url);
    items.push({
      id: s.case_id,
      category: s.category,
      categoryLabel: s.category_label,
      categoryFilterLabel: s.category_filter_label || s.category_label,
      title: s.title,
      fullTitle: s.full_title || s.title,
      client: s.client,
      value: s.value,
      valueBadge: s.value_badge,
      location: s.location,
      scope: s.scope,
      image: urls[0] || '',
      images: urls,
      shortDesc: s.short_desc,
      description: s.description,
    });
  }
  return { ...base, items };
}

async function putGallery(data) {
  await upsertPageMeta('gallery', data.hero, data.highlights);
  await db('gallery_images').del();
  await db('gallery_case_studies').del();
  const items = Array.isArray(data.items) ? data.items : [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const caseId = item.id || `gallery-${i + 1}-${Date.now()}`;
    await db('gallery_case_studies').insert({
      case_id: caseId,
      category: item.category,
      category_label: item.categoryLabel || item.category,
      category_filter_label: item.categoryFilterLabel || null,
      title: item.title,
      full_title: item.fullTitle || item.title,
      client: item.client || null,
      value: item.value || null,
      value_badge: item.valueBadge || null,
      location: item.location || null,
      scope: item.scope || null,
      short_desc: item.shortDesc || null,
      description: item.description || null,
      sort_order: i,
    });
    const study = await db('gallery_case_studies').where({ case_id: caseId }).first();
    const urls = Array.isArray(item.images) && item.images.length
      ? item.images
      : (item.image ? [item.image] : []);
    if (urls.length && study) {
      await db('gallery_images').insert(
        urls.map((url, imgIdx) => ({
          case_study_id: study.id,
          url: String(url),
          sort_order: imgIdx,
        }))
      );
    }
  }
  return getGallery();
}

async function getFleet() {
  const hasLogoCol = await db.schema.hasColumn('fleet_assets', 'logo_url');
  const rows = await db('fleet_assets').orderBy('sort_order', 'asc');
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    count: r.count,
    icon: r.icon,
    logoUrl: hasLogoCol ? (r.logo_url || '') : '',
  }));
}

async function putFleet(list) {
  const hasLogoCol = await db.schema.hasColumn('fleet_assets', 'logo_url');
  await db('fleet_assets').del();
  const arr = Array.isArray(list) ? list : [];
  if (arr.length) {
    await db('fleet_assets').insert(
      arr.map((f, i) => {
        const row = {
          key: f.key || `fleet-${i}`,
          name: f.name,
          count: String(f.count ?? ''),
          icon: f.icon || null,
          sort_order: i,
        };
        if (hasLogoCol) {
          row.logo_url = f.logoUrl || f.logo_url || null;
        }
        return row;
      })
    );
  }
  return getFleet();
}

/**
 * @param {{ includeHiddenSeries?: boolean }} [opts]
 * Public callers omit unpublished turnover years; admin includes them.
 */
async function getFinancials(opts = {}) {
  const includeHiddenSeries = Boolean(opts.includeHiddenSeries);
  const sections = await db('financial_sections').orderBy('sort_order', 'asc');
  const series = await db('financial_turnover_years').orderBy('sort_order', 'asc');
  return sections.map((s) => {
    const item = {
      key: s.key,
      title: s.title,
      icon: s.icon,
      text: s.text,
    };
    if (s.key === 'turnover') {
      item.currency = s.currency || 'inr_millions';
      item.series = series
        .filter((row) => includeHiddenSeries || Boolean(row.visible))
        .map((row) => ({
          year: row.year,
          amount: Number(row.amount),
          source: row.source,
          visible: Boolean(row.visible),
        }));
    }
    return item;
  });
}

async function putFinancials(list) {
  const arr = Array.isArray(list) ? list : [];
  await db('financial_sections').del();
  await db('financial_turnover_years').del();
  for (let i = 0; i < arr.length; i += 1) {
    const s = arr[i];
    await db('financial_sections').insert({
      key: s.key,
      title: s.title,
      icon: s.icon || null,
      text: s.text,
      currency: s.key === 'turnover' ? (s.currency || 'inr_millions') : null,
      sort_order: i,
    });
    if (s.key === 'turnover' && Array.isArray(s.series)) {
      await db('financial_turnover_years').insert(
        s.series.map((row, idx) => ({
          year: row.year,
          amount: Number(row.amount) || 0,
          source: row.source || 'admin',
          visible: row.visible !== false,
          sort_order: idx,
        }))
      );
    }
  }
  return getFinancials({ includeHiddenSeries: true });
}

async function getTeamPhotos() {
  const rows = await db('team_photos').orderBy('sort_order', 'asc');
  return rows.map((r) => ({
    id: r.photo_id,
    url: r.url,
    caption: r.caption,
  }));
}

async function putTeamPhotos(list) {
  await db('team_photos').del();
  const arr = Array.isArray(list) ? list : [];
  if (arr.length) {
    await db('team_photos').insert(
      arr.map((p, i) => ({
        photo_id: p.id || `img-${i + 1}`,
        url: p.url,
        caption: p.caption || '',
        sort_order: i,
      }))
    );
  }
  return getTeamPhotos();
}

const GALLERY_MEDIA_SECTIONS = Object.freeze([
  'plant_machinery',
  'founder_clients',
  'certificates',
  'founder_logos',
]);

function parseMetaJson(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((m) => {
        if (typeof m === 'string') return { icon: '', text: m };
        return {
          icon: String((m && m.icon) || ''),
          text: String((m && m.text) || ''),
        };
      })
      .filter((m) => m.text);
  } catch (e) {
    return [];
  }
}

function mapGalleryMediaRow(r) {
  return {
    id: r.item_id,
    url: r.url,
    title: r.title || '',
    badge: r.badge || '',
    badgeIcon: r.badge_icon || '',
    location: r.location || '',
    locationIcon: r.location_icon || '',
    description: r.description || '',
    author: r.author || '',
    quote: r.quote || '',
    meta: parseMetaJson(r.meta_json),
  };
}

function assertGalleryMediaSection(section) {
  const key = String(section || '').trim();
  if (!GALLERY_MEDIA_SECTIONS.includes(key)) {
    const err = new Error(`Unknown gallery media section: ${key}`);
    err.status = 400;
    throw err;
  }
  return key;
}

async function getGalleryMedia(section) {
  const key = assertGalleryMediaSection(section);
  const rows = await db('gallery_media_items')
    .where({ section: key })
    .orderBy('sort_order', 'asc');
  return rows.map(mapGalleryMediaRow);
}

async function getAllGalleryMedia() {
  const out = {};
  for (const section of GALLERY_MEDIA_SECTIONS) {
    out[section] = await getGalleryMedia(section);
  }
  return out;
}

async function putGalleryMedia(section, list) {
  const key = assertGalleryMediaSection(section);
  const arr = Array.isArray(list) ? list : [];

  await db.transaction(async (trx) => {
    await trx('gallery_media_items').where({ section: key }).del();
    if (!arr.length) return;
    await trx('gallery_media_items').insert(
      arr.map((item, i) => {
        const meta = Array.isArray(item.meta) ? item.meta : [];
        return {
          item_id: item.id || `${key}-${i + 1}`,
          section: key,
          url: item.url,
          title: item.title || null,
          badge: item.badge || null,
          badge_icon: item.badgeIcon || null,
          location: item.location || null,
          location_icon: item.locationIcon || null,
          description: item.description || null,
          author: item.author || null,
          quote: item.quote || null,
          meta_json: meta.length ? JSON.stringify(meta) : null,
          sort_order: i,
        };
      })
    );
  });

  return getGalleryMedia(key);
}

async function getInquiries() {
  const rows = await db('inquiries').orderBy('id', 'desc');
  return rows.map((r) => ({
    id: r.inquiry_id,
    name: r.name,
    company: r.company,
    email: r.email,
    phone: r.phone,
    subject: r.subject,
    message: r.message,
    date: r.created_at,
    status: r.status,
    priority: r.priority,
    value: r.value,
  }));
}

async function createInquiry(data) {
  // Public POST must never accept client-chosen id/status (defense in depth vs schema).
  const inquiryId = `INQ-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`;
  await db('inquiries').insert({
    inquiry_id: inquiryId,
    name: data.name,
    company: data.company || null,
    email: data.email,
    phone: data.phone || null,
    subject: data.subject,
    message: data.message,
    status: 'NEW',
    // Public create: never trust client priority/value (over-posting).
    priority: 'MEDIUM',
    value: null,
  });
  const rows = await db('inquiries').where({ inquiry_id: inquiryId }).first();
  return {
    id: rows.inquiry_id,
    name: rows.name,
    company: rows.company,
    email: rows.email,
    phone: rows.phone,
    subject: rows.subject,
    message: rows.message,
    date: rows.created_at,
    status: rows.status,
    priority: rows.priority,
    value: rows.value,
  };
}

async function updateInquiryStatus(inquiryId, status) {
  const updated = await db('inquiries').where({ inquiry_id: inquiryId }).update({
    status,
    updated_at: db.fn.now(),
  });
  if (!updated) {
    const err = new Error('Inquiry not found.');
    err.status = 404;
    throw err;
  }
  return (await getInquiries()).find((i) => i.id === inquiryId);
}

module.exports = {
  getInfrastructure,
  putInfrastructure,
  getProjectsPage,
  putProjectsPage,
  getGallery,
  putGallery,
  getFleet,
  putFleet,
  getFinancials,
  putFinancials,
  getTeamPhotos,
  putTeamPhotos,
  GALLERY_MEDIA_SECTIONS,
  getGalleryMedia,
  getAllGalleryMedia,
  putGalleryMedia,
  getInquiries,
  createInquiry,
  updateInquiryStatus,
};
