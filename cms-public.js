/**
 * Sekar Construction — Public CMS client
 * Hydrates marketing pages from /api/public/* only.
 * No admin auth, password hashes, TOTP secrets, audit, or lockout logic.
 * Compatible with script.js via window.SekarAdminSecurity read helpers.
 */
(function (window) {
  'use strict';

  const EMPTY_HERO = {
    brand: '',
    title: '',
    lead: '',
    ctaLabel: '',
    ctaHref: '',
    image: ''
  };

  class PublicCmsClient {
    constructor() {
      this._cmsCache = {};
      this.apiReady = this.useApi() ? this.hydrateFromApi() : Promise.resolve();
    }

    getApiBase() {
      const raw = (window.SekarConfig && window.SekarConfig.apiBaseUrl) || '';
      return String(raw).trim().replace(/\/$/, '');
    }

    useApi() {
      return Boolean(this.getApiBase());
    }

    async apiFetch(path, options) {
      const base = this.getApiBase();
      if (!base) throw new Error('API base URL not configured');
      const opts = options || {};
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      const res = await fetch(base + path, Object.assign({}, opts, {
        headers: headers,
        credentials: 'include'
      }));
      let body = null;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = { raw: text };
      }
      if (!res.ok) {
        const msg = (body && body.error && body.error.message) || res.statusText || 'Request failed';
        const err = new Error(msg);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    }

    async hydrateFromApi() {
      if (!this.useApi()) return;
      const endpoints = [
        ['infrastructure', '/api/public/infrastructure'],
        ['ongoing', '/api/public/ongoing-projects'],
        ['completed', '/api/public/completed-projects'],
        ['gallery', '/api/public/gallery'],
        ['fleet', '/api/public/fleet'],
        ['financials', '/api/public/financials'],
        ['team', '/api/public/team-photos'],
        ['galleryMedia', '/api/public/gallery-media']
      ];
      await Promise.all(endpoints.map(async ([key, path]) => {
        try {
          this._cmsCache[key] = await this.apiFetch(path, { method: 'GET', headers: {} });
        } catch (err) {
          console.warn('Failed to hydrate CMS from API:', path, err.message);
        }
      }));
    }

    _readLocal(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    getFleetInventory() {
      if (this.useApi()) {
        return Array.isArray(this._cmsCache.fleet) ? this._cmsCache.fleet : [];
      }
      const stored = this._readLocal('sc_admin_fleet_v1');
      return Array.isArray(stored) ? stored : [];
    }

    getGalleryPhotos() {
      // API mode: never resurrect hardcoded team URLs when hydrate fails.
      if (this.useApi()) {
        return Array.isArray(this._cmsCache.team) ? this._cmsCache.team : [];
      }
      const stored = this._readLocal('sc_admin_team_gallery_v1');
      return Array.isArray(stored) ? stored : [];
    }

    getGalleryMediaSections() {
      return ['plant_machinery', 'founder_clients', 'certificates', 'founder_logos'];
    }

    normalizeGalleryMediaSection(section) {
      return String(section || '').trim().replace(/-/g, '_');
    }

    getGalleryMediaContent(section) {
      const key = this.normalizeGalleryMediaSection(section);
      if (!this.getGalleryMediaSections().includes(key)) return [];

      if (this.useApi()) {
        const bag = this._cmsCache.galleryMedia;
        if (bag && typeof bag === 'object' && Array.isArray(bag[key])) {
          return bag[key];
        }
        return [];
      }

      const stored = this._readLocal('sc_admin_gallery_media_' + key + '_v1');
      return Array.isArray(stored) ? stored : [];
    }

    getTurnoverCurrencyOptions() {
      return [
        { id: 'inr_millions', selectLabel: 'INR / Rs. (millions)', short: 'Rs.', unit: 'millions', axis: 'Rs. Millions', chartUnit: 'Rs. millions · FY' },
        { id: 'inr_crore', selectLabel: 'INR / Rs. (Crore)', short: 'Rs.', unit: 'Crore', axis: 'Rs. Crore', chartUnit: 'Rs. Crore · FY' },
        { id: 'usd_millions', selectLabel: 'USD (millions)', short: 'USD', unit: 'millions', axis: 'USD Millions', chartUnit: 'USD millions · FY' },
        { id: 'eur_millions', selectLabel: 'EUR (millions)', short: 'EUR', unit: 'millions', axis: 'EUR Millions', chartUnit: 'EUR millions · FY' }
      ];
    }

    getTurnoverCurrencyMeta(currencyId) {
      const options = this.getTurnoverCurrencyOptions();
      return options.find((opt) => opt.id === currencyId) || options[0];
    }

    getFinancialsData() {
      if (this.useApi()) {
        return Array.isArray(this._cmsCache.financials) ? this._cmsCache.financials : [];
      }
      const stored = this._readLocal('sc_admin_financials_v4');
      return Array.isArray(stored) ? stored : [];
    }

    getInfrastructureContent() {
      if (this.useApi()) {
        const data = this._cmsCache.infrastructure;
        if (!data || typeof data !== 'object') {
          return { hero: Object.assign({}, EMPTY_HERO), highlights: [], inventory: [] };
        }
        return data;
      }
      const stored = this._readLocal('sc_admin_infrastructure_v2');
      if (stored && typeof stored === 'object') return stored;
      return { hero: Object.assign({}, EMPTY_HERO), highlights: [], inventory: [] };
    }

    getOngoingRegionPresets() {
      return [
        { value: 'ap', label: 'Andhra Pradesh', badge: 'AP' },
        { value: 'ar', label: 'Arunachal Pradesh', badge: 'AR' },
        { value: 'as', label: 'Assam', badge: 'AS' },
        { value: 'br', label: 'Bihar', badge: 'BR' },
        { value: 'cg', label: 'Chhattisgarh', badge: 'CG' },
        { value: 'ga', label: 'Goa', badge: 'GA' },
        { value: 'gj', label: 'Gujarat', badge: 'GJ' },
        { value: 'hr', label: 'Haryana', badge: 'HR' },
        { value: 'hp', label: 'Himachal Pradesh', badge: 'HP' },
        { value: 'jh', label: 'Jharkhand', badge: 'JH' },
        { value: 'ka', label: 'Karnataka', badge: 'KA' },
        { value: 'kl', label: 'Kerala', badge: 'KL' },
        { value: 'mp', label: 'Madhya Pradesh', badge: 'MP' },
        { value: 'mh', label: 'Maharashtra', badge: 'MH' },
        { value: 'mn', label: 'Manipur', badge: 'MN' },
        { value: 'ml', label: 'Meghalaya', badge: 'ML' },
        { value: 'mz', label: 'Mizoram', badge: 'MZ' },
        { value: 'nl', label: 'Nagaland', badge: 'NL' },
        { value: 'od', label: 'Odisha', badge: 'OD' },
        { value: 'pb', label: 'Punjab', badge: 'PB' },
        { value: 'rj', label: 'Rajasthan', badge: 'RJ' },
        { value: 'sk', label: 'Sikkim', badge: 'SK' },
        { value: 'tn', label: 'Tamil Nadu', badge: 'TN' },
        { value: 'ts', label: 'Telangana', badge: 'TS' },
        { value: 'tr', label: 'Tripura', badge: 'TR' },
        { value: 'up', label: 'Uttar Pradesh', badge: 'UP' },
        { value: 'uk', label: 'Uttarakhand', badge: 'UK' },
        { value: 'wb', label: 'West Bengal', badge: 'WB' },
        { value: 'an', label: 'Andaman and Nicobar Islands', badge: 'AN' },
        { value: 'ch', label: 'Chandigarh', badge: 'CH' },
        { value: 'dn', label: 'Dadra and Nagar Haveli and Daman and Diu', badge: 'DN' },
        { value: 'dl', label: 'Delhi', badge: 'DL' },
        { value: 'jk', label: 'Jammu and Kashmir', badge: 'JK' },
        { value: 'la', label: 'Ladakh', badge: 'LA' },
        { value: 'ld', label: 'Lakshadweep', badge: 'LD' },
        { value: 'py', label: 'Puducherry', badge: 'PY' }
      ];
    }

    getOngoingRegionDisplayOrder(regions) {
      const list = Array.isArray(regions) ? regions.slice() : this.getOngoingRegionPresets();
      const priority = { tn: 0, ap: 1 };
      return list.sort((a, b) => {
        const pa = priority[a.value] !== undefined ? priority[a.value] : 100;
        const pb = priority[b.value] !== undefined ? priority[b.value] : 100;
        if (pa !== pb) return pa - pb;
        return String(a.label || a.value).localeCompare(String(b.label || b.value), 'en');
      });
    }

    slugifyOngoingRegion(label) {
      const base = String(label || '')
        .toLowerCase()
        .trim()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
      return base || ('region-' + Date.now());
    }

    getOngoingRegionOptions(projects) {
      const presets = this.getOngoingRegionPresets();
      const map = new Map(presets.map((r) => [r.value, Object.assign({}, r)]));
      const reserved = new Set(presets.map((r) => r.value).concat(['all', 'other', 'custom', 'region']));

      (Array.isArray(projects) ? projects : []).forEach((row) => {
        if (!row) return;
        const label = String(row.regionLabel || '').trim();
        let key = String(row.region || '').trim();
        if (!key && label) key = this.slugifyOngoingRegion(label);
        if (!key || (reserved.has(key) && !map.has(key))) {
          if (!label) return;
          key = this.slugifyOngoingRegion(label);
          if (reserved.has(key) || map.has(key)) key = 'region-' + key;
        }
        if (map.has(key)) {
          if (label && !presets.some((p) => p.value === key)) {
            map.get(key).label = label;
          }
          return;
        }
        const badge = (label || key)
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase())
          .join('')
          .slice(0, 4) || key.toUpperCase().slice(0, 4);
        map.set(key, { value: key, label: label || key, badge: badge });
      });

      return Array.from(map.values());
    }

    getOngoingProjectsContent() {
      if (this.useApi()) {
        const data = this._cmsCache.ongoing;
        if (!data || typeof data !== 'object') {
          return { hero: Object.assign({}, EMPTY_HERO), highlights: [], projects: [] };
        }
        return data;
      }
      const stored = this._readLocal('sc_admin_ongoing_projects_v2');
      if (stored && typeof stored === 'object') return stored;
      return { hero: Object.assign({}, EMPTY_HERO), highlights: [], projects: [] };
    }

    getCompletedRegionPresets() {
      return this.getOngoingRegionPresets();
    }

    getCompletedRegionDisplayOrder(regions) {
      return this.getOngoingRegionDisplayOrder(regions);
    }

    getCompletedRegionOptions(projects) {
      return this.getOngoingRegionOptions(projects);
    }

    getCompletedProjectsContent() {
      if (this.useApi()) {
        const data = this._cmsCache.completed;
        if (!data || typeof data !== 'object') {
          return { hero: Object.assign({}, EMPTY_HERO), highlights: [], projects: [] };
        }
        return data;
      }
      const stored = this._readLocal('sc_admin_completed_projects_v2');
      if (stored && typeof stored === 'object') return stored;
      return { hero: Object.assign({}, EMPTY_HERO), highlights: [], projects: [] };
    }

    getProjectGalleryCategoryPresets() {
      return [
        { value: 'infrastructure', label: 'Infrastructure' },
        { value: 'industrial', label: 'Industrial' },
        { value: 'commercial', label: 'Commercial' }
      ];
    }

    getProjectGalleryCategoryOptions(items) {
      const presets = this.getProjectGalleryCategoryPresets();
      const presetMap = Object.fromEntries(presets.map((c) => [c.value, c]));
      const list = Array.isArray(items) ? items : [];
      const extras = [];
      list.forEach((item) => {
        const key = String(item.category || '').trim();
        if (!key || presetMap[key] || extras.some((e) => e.value === key)) return;
        extras.push({
          value: key,
          label: String(item.categoryFilterLabel || item.categoryLabel || key).trim() || key
        });
      });
      return presets.concat(extras);
    }

    /**
     * Bundled case studies that must appear even when API / localStorage is stale
     * (Admin Save & Publish not yet run). Mirrors admin-auth missingDefaults merge.
     */
    getBundledProjectGalleryDefaults() {
      return [
        {
          id: 'gallery-isro-c25',
          category: 'industrial',
          categoryFilterLabel: 'Industrial',
          categoryLabel: 'Aerospace / Institutional',
          title: 'ISRO C25 Integration Complex',
          fullTitle: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri',
          client: 'Indian Space Research Organisation (ISRO)',
          value: '₹56.30 Crore',
          valueBadge: '₹56.30 Cr',
          location: 'IPRC, Mahendragiri, TN',
          scope: 'C25 Stage Integration Complex, 1,00,000 CUM clean room, civil, PH, storm water drains, mechanical doors, area development',
          image: 'isro-c25-integration-exterior.png',
          images: [
            'isro-c25-integration-exterior.png',
            'isro-c25-facade.png',
            'isro-clean-room-interior.png'
          ],
          shortDesc: 'C25 Stage Integration Complex with 1,00,000 CUM clean room and area development works at IPRC, Mahendragiri.',
          description: 'Construction of the C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri for the ISRO Propulsion Complex. Scope included civil works, public health, storm water drains, mechanical doors, and a 1,00,000 CUM capacity clean room for stage integration.'
        },
        {
          id: 'gallery-igcar-hall-v',
          category: 'industrial',
          categoryFilterLabel: 'Industrial',
          categoryLabel: 'Nuclear / Institutional',
          title: 'IGCAR Engineering Hall V',
          fullTitle: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam',
          client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
          value: '₹36.55 Crore',
          valueBadge: '₹36.55 Cr',
          location: 'IGCAR, Kalpakkam, TN',
          scope: 'Engineering Hall – V civil construction',
          image: 'igcar-engineering-hall-v.png',
          images: ['igcar-engineering-hall-v.png'],
          shortDesc: 'Engineering Hall – V civil construction for IGCAR at Kalpakkam.',
          description: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).'
        },
        {
          id: 'gallery-igcar-water-tank',
          category: 'infrastructure',
          categoryFilterLabel: 'Infrastructure',
          categoryLabel: 'Water Utilities',
          title: 'IGCAR Water Tank',
          fullTitle: 'Construction of Water Tanker 4.5Lakhs Capacity 18m Height at IGCAR, Kalpakkam',
          client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
          value: '',
          valueBadge: '',
          location: 'IGCAR, Kalpakkam, TN',
          scope: 'Elevated water tank, 4.5 lakh litre capacity, 18 m height',
          image: 'igcar-water-tank.png',
          images: ['igcar-water-tank.png'],
          shortDesc: '4.5 lakh litre capacity elevated water tank (18 m height) under construction at IGCAR, Kalpakkam.',
          description: 'Construction of an elevated water tank of 4.5 lakh litre capacity and 18 m height at IGCAR, Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).'
        },
        {
          id: 'gallery-dae-quarters',
          category: 'commercial',
          categoryFilterLabel: 'Commercial',
          categoryLabel: 'Residential Township',
          title: 'DAE Type II-B Quarters',
          fullTitle: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam [including electrical work]',
          client: 'Department of Atomic Energy (DAE)',
          value: '₹25.83 Crore',
          valueBadge: '₹25.83 Cr',
          location: 'DAE Township, Kalpakkam, TN',
          scope: '116 Nos. Type II-B residential quarters including electrical work',
          image: 'dae-kalpakkam-type-iib-quarters.png',
          images: ['dae-kalpakkam-type-iib-quarters.png'],
          shortDesc: '116 Type II-B residential quarters with electrical works in DAE Township at Kalpakkam.',
          description: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam, including electrical work. The project delivered multi-storey township housing blocks with associated electrical installations for Department of Atomic Energy residential accommodation.'
        }
      ];
    }

    _mergeMissingGalleryDefaults(data) {
      if (!data || typeof data !== 'object') return data;
      const items = Array.isArray(data.items) ? data.items.slice() : [];
      const presentIds = new Set(
        items.map((item) => String(item && item.id || '').trim()).filter(Boolean)
      );
      const presentTitles = new Set(
        items.map((item) => String((item && (item.fullTitle || item.title)) || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const presentCovers = new Set(
        items.map((item) => {
          const imgs = item && Array.isArray(item.images) ? item.images : [];
          return String((imgs[0] || (item && item.image) || '')).trim().toLowerCase();
        }).filter(Boolean)
      );

      const missing = this.getBundledProjectGalleryDefaults().filter((def) => {
        if (presentIds.has(def.id)) return false;
        const titleKey = String(def.fullTitle || def.title || '').trim().toLowerCase();
        if (titleKey && presentTitles.has(titleKey)) return false;
        const coverKey = String(def.image || '').trim().toLowerCase();
        if (coverKey && presentCovers.has(coverKey)) return false;
        return true;
      });

      if (!missing.length) return data;

      const mergedItems = items.concat(missing);
      const highlights = Array.isArray(data.highlights)
        ? data.highlights.map((h) => {
          const next = Object.assign({}, h);
          if (String(next.key || '').toLowerCase() === 'studies' && /^\d+$/.test(String(next.value || '').trim())) {
            const n = Number(next.value);
            if (mergedItems.length > n) next.value = String(mergedItems.length);
          }
          return next;
        })
        : data.highlights;

      return Object.assign({}, data, { items: mergedItems, highlights: highlights });
    }

    getProjectGalleryContent() {
      // API mode: merge bundled defaults when hydrate is stale / incomplete.
      if (this.useApi()) {
        const data = this._cmsCache.gallery;
        if (!data || typeof data !== 'object') {
          return { hero: Object.assign({}, EMPTY_HERO, { ctaHref: '#project-gallery' }), highlights: [], items: [] };
        }
        return this._mergeMissingGalleryDefaults(data);
      }
      const stored = this._readLocal('sc_admin_project_gallery_v3')
        || this._readLocal('sc_admin_project_gallery_v2')
        || this._readLocal('sc_admin_project_gallery_v1');
      if (stored && typeof stored === 'object') {
        return this._mergeMissingGalleryDefaults(stored);
      }
      return { hero: Object.assign({}, EMPTY_HERO, { ctaHref: '#project-gallery' }), highlights: [], items: [] };
    }

    async addInquiry(inquiryData) {
      if (this.useApi()) {
        return await this.apiFetch('/api/inquiries', {
          method: 'POST',
          body: JSON.stringify({
            name: inquiryData.name || 'Anonymous',
            company: inquiryData.company || 'Private Client',
            email: inquiryData.email,
            phone: inquiryData.phone || null,
            subject: inquiryData.subject || 'General Project Query',
            message: inquiryData.message,
            value: inquiryData.value || null
          })
        });
      }
      const inquiries = this._readLocal('sc_admin_inquiries_v1') || [];
      const newInquiry = {
        id: 'INQ-2026-' + (inquiries.length + 1).toString().padStart(3, '0'),
        name: inquiryData.name || 'Anonymous',
        company: inquiryData.company || 'Private Client',
        email: inquiryData.email,
        phone: inquiryData.phone || 'N/A',
        subject: inquiryData.subject || 'General Project Query',
        message: inquiryData.message,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'NEW',
        priority: 'HIGH',
        value: inquiryData.value || 'TBD'
      };
      inquiries.unshift(newInquiry);
      try {
        localStorage.setItem('sc_admin_inquiries_v1', JSON.stringify(inquiries));
      } catch (e) { /* ignore quota */ }
      return newInquiry;
    }
  }

  const client = new PublicCmsClient();
  window.SekarCMS = client;
  // script.js compatibility alias (read/hydrate + contact inquiry only)
  window.SekarAdminSecurity = client;
  window.SekarAdminReady = client.apiReady;
})(window);
