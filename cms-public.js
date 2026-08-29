/**
 * Sekar Construction — Public CMS client
 * Hydrates marketing pages from /api/public/* only.
 * No admin auth, password hashes, TOTP secrets, audit, or lockout logic.
 * Compatible with script.js via window.SekarAdminSecurity read helpers.
 */
(function (window) {
  'use strict';

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

    getBundledFleetDefaults() {
      return [
        { key: 'rmc', name: 'RMC Batching Plants', count: '5', icon: 'fa-industry' },
        { key: 'mixers', name: 'Transit Mixers', count: '12', icon: 'fa-truck' },
        { key: 'pumps', name: 'Schwing Stetter S36X Boom Pumps', count: '2', icon: 'fa-truck-droplet' },
        { key: 'tippers', name: 'Tipper Trucks', count: '15', icon: 'fa-truck-moving' },
        { key: 'excavators', name: 'Excavators & JCBS', count: '4', icon: 'fa-tractor' },
        { key: 'crushers', name: 'Crusher Units', count: '3', icon: 'fa-gears' },
        { key: 'quarries', name: 'Blue Metal Quarries', count: '3', icon: 'fa-mountain' },
        { key: 'bending', name: 'Bar Bending Machines', count: '2', icon: 'fa-screwdriver-wrench' },
        { key: 'shearing', name: 'Bar Shearing Machines', count: '2', icon: 'fa-scissors' },
        { key: 'scaffolding', name: 'Scaffolding Pipes', count: '30k', icon: 'fa-layer-group' }
      ];
    }

    getFleetInventory() {
      if (this.useApi()) {
        const data = this._cmsCache.fleet;
        return Array.isArray(data) && data.length ? data : this.getBundledFleetDefaults();
      }
      const stored = this._readLocal('sc_admin_fleet_v1');
      return Array.isArray(stored) && stored.length ? stored : this.getBundledFleetDefaults();
    }

    getBundledTeamPhotoDefaults() {
      return [
        { id: 'img-1', url: 'dynamic-team-1.jpg', caption: 'Sekar Constructions Executive Team' },
        { id: 'img-2', url: 'dynamic-team-2.jpg', caption: 'Sekar Constructions Engineering Team on Site' },
        { id: 'img-3', url: 'dynamic-team-3.jpg', caption: 'Sekar Constructions Civil Work Force' }
      ];
    }

    getGalleryPhotos() {
      if (this.useApi()) {
        const data = this._cmsCache.team;
        return Array.isArray(data) && data.length ? data : this.getBundledTeamPhotoDefaults();
      }
      const stored = this._readLocal('sc_admin_team_gallery_v1');
      return Array.isArray(stored) && stored.length ? stored : this.getBundledTeamPhotoDefaults();
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

    getBundledFinancialsDefaults() {
      return [
        {
          key: 'turnover',
          title: 'Annual Turnover',
          icon: 'fa-chart-line',
          text: 'Our financial progress reached a whopping annual turnover to the tune of Rs.1420 millions during the Financial Year 2025–26.',
          currency: 'inr_millions',
          series: [
            { year: '2020-21', amount: 560, source: 'published', visible: true },
            { year: '2021-22', amount: 720, source: 'published', visible: true },
            { year: '2022-23', amount: 850, source: 'published', visible: true },
            { year: '2023-24', amount: 990, source: 'published', visible: true },
            { year: '2024-25', amount: 1175, source: 'published', visible: true },
            { year: '2025-26', amount: 1420, source: 'published', visible: true },
            { year: '2026-27', amount: 1650, source: 'published', visible: false },
            { year: '2027-28', amount: 1900, source: 'published', visible: false },
            { year: '2028-29', amount: 2200, source: 'published', visible: false },
            { year: '2029-30', amount: 2500, source: 'published', visible: false },
            { year: '2030-31', amount: 2800, source: 'published', visible: false }
          ]
        },
        {
          key: 'resources',
          title: 'Financial Resources',
          icon: 'fa-vault',
          text: 'The financial credibility of the firm has enabled it to secure a Cash Credit Limit of Rs.10.00 Crore and Bank Guarantee Limit of Rs. 25.00 Crore from HDFC, Kalpakkam. Besides this, we are well supported by Banks and Partners.'
        },
        {
          key: 'quality',
          title: 'Quality Assurance',
          icon: 'fa-award',
          text: 'Timely completion with Absolute Quality Control has long been the specialty of Sekar Constructions. Continuous orders from the Department of Atomic Energy and allied premier institutions stand as evidence of that commitment.'
        }
      ];
    }

    getFinancialsData() {
      if (this.useApi()) {
        const data = this._cmsCache.financials;
        return Array.isArray(data) && data.length ? data : this.getBundledFinancialsDefaults();
      }
      const stored = this._readLocal('sc_admin_financials_v4');
      return Array.isArray(stored) && stored.length ? stored : this.getBundledFinancialsDefaults();
    }

    /**
     * Bundled inventory for static hosts (GitHub Pages) and API/localStorage misses.
     * Mirrors admin-auth getDefaultInfrastructureData / api seeds.
     */
    getBundledInfrastructureDefaults() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Infrastructure & Assets',
          lead: 'Owned quarries, crushing plants, batching machinery, and a full fleet - engineered for quality, schedule certainty, and self-reliant execution.',
          ctaLabel: 'Explore Inventory',
          ctaHref: '#infra-inventory',
          image: 'bhel-btg-civil.jpg'
        },
        highlights: [
          { key: 'quarries', label: 'Quarries', value: '4', note: 'Blue metal quarries under direct ownership' },
          { key: 'crushing', label: 'Crushing Plants', value: '3', note: 'Dedicated crushing capacity for project supply' },
          { key: 'assets', label: 'Asset Lines', value: '44', note: 'Owned equipment inventory line items' }
        ],
        inventory: [
          { id: 'infra-1', category: 'own-equipments', description: 'Concrete Boom Pump - 40.10ZX, S36X', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-2', category: 'own-equipments', description: 'Batching Plant - M1T, M1C, KYB 450 & CP45, Z30 & CP30', qty: '6', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-3', category: 'own-equipments', description: 'RMC Transit Mixer', qty: '14', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-4', category: 'own-equipments', description: 'Concrete Pump 1800', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-5', category: 'own-equipments', description: 'Mobile Tower Crane [ACE Make]', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-6', category: 'own-equipments', description: 'Excavator - Hitachi EX 210', qty: '2', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-7', category: 'own-equipments', description: 'JCB', qty: '8', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-8', category: 'own-equipments', description: 'Vibromax 10T - Roller', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-9', category: 'own-equipments', description: 'Walking Roller 1MT', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-10', category: 'own-equipments', description: 'BOBCAT S450', qty: '5', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-11', category: 'own-equipments', description: 'Tipper 10 Wheel', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-12', category: 'own-equipments', description: 'Tractor', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-13', category: 'own-equipments', description: 'TATA Diesel Tanker', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-14', category: 'own-equipments', description: 'Mahindra & Eicher Van', qty: '8', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-15', category: 'own-equipments', description: 'Building Hoist', qty: '5', unit: 'Sets.', categoryLabel: 'Own Equipments' },
          { id: 'infra-16', category: 'own-equipments', description: 'MS Cuplock System', qty: '400', unit: 'MT', categoryLabel: 'Own Equipments' },
          { id: 'infra-17', category: 'own-equipments', description: 'System Form Work', qty: '4,120', unit: 'Sqm', categoryLabel: 'Own Equipments' },
          { id: 'infra-18', category: 'own-equipments', description: 'MS Jolly (Platform)', qty: '6,500', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-19', category: 'own-equipments', description: 'MS Scaffolding Pipes', qty: '30,000', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-20', category: 'own-equipments', description: 'Props 2+2m, 2+3m, 3+3m', qty: '3,500', unit: 'Sets.', categoryLabel: 'Own Equipments' },
          { id: 'infra-21', category: 'own-equipments', description: 'Agrow Spans 2.4m & 3.0m', qty: '1,500', unit: 'Sets.', categoryLabel: 'Own Equipments' },
          { id: 'infra-22', category: 'own-equipments', description: 'Centering Sheets 3\' x 2\', 4\' x 2\'', qty: '1,500', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-23', category: 'own-equipments', description: 'MS Velor 1.50m & 1.20m', qty: '1,300', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-24', category: 'own-equipments', description: 'Bar Shearing Machine', qty: '15', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-25', category: 'own-equipments', description: 'Bar Bending Machine', qty: '15', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-26', category: 'own-equipments', description: 'Bar Rings Machine', qty: '2', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-27', category: 'own-equipments', description: 'Bar Threading Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-28', category: 'own-equipments', description: 'Concrete Vibrators', qty: '28', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-29', category: 'own-equipments', description: 'Watering & De-Watering Pumps 5HP, 3HP', qty: '21', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-30', category: 'own-equipments', description: 'Total Station', qty: '7', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-31', category: 'own-equipments', description: 'Levelling Instrument', qty: '18', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-32', category: 'own-equipments', description: 'Cube Testing Machine', qty: '10', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-33', category: 'own-equipments', description: 'Soil Compacting Machine', qty: '7', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-34', category: 'own-equipments', description: 'Wood Plaining Machine', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-35', category: 'own-equipments', description: 'Wood Circular Saw Machine', qty: '25', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-36', category: 'own-equipments', description: 'Welding Machine 3PH & 1PH', qty: '15', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-37', category: 'own-equipments', description: 'Hydraulic Block Making Machine', qty: '2', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-38', category: 'own-equipments', description: 'Fly Ash brick manufacturing Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-39', category: 'own-equipments', description: 'Paver/Cover block Vibration Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-40', category: 'own-equipments', description: 'Stone Crushing Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-41', category: 'own-equipments', description: 'Mixer Machine - Diesel & Electrical', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-42', category: 'own-equipments', description: 'Crusher Plant', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-43', category: 'own-equipments', description: 'Blue Metal Quarry', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-44', category: 'own-equipments', description: 'Weight Bridge 100MT', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' }
        ]
      };
    }

    _infrastructureWithInventoryFallback(data) {
      const bundled = this.getBundledInfrastructureDefaults();
      if (!data || typeof data !== 'object') {
        return JSON.parse(JSON.stringify(bundled));
      }
      const inventory = Array.isArray(data.inventory) ? data.inventory : [];
      if (inventory.length) return data;
      return Object.assign({}, data, {
        hero: data.hero && (data.hero.title || data.hero.brand) ? data.hero : bundled.hero,
        highlights: Array.isArray(data.highlights) && data.highlights.length ? data.highlights : bundled.highlights,
        inventory: bundled.inventory.slice()
      });
    }

    getInfrastructureContent() {
      if (this.useApi()) {
        return this._infrastructureWithInventoryFallback(this._cmsCache.infrastructure);
      }
      const stored = this._readLocal('sc_admin_infrastructure_v2');
      return this._infrastructureWithInventoryFallback(stored);
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

    /**
     * Bundled ongoing-projects directory for static hosts (GitHub Pages)
     * and API/localStorage misses. Mirrors admin-auth / api seeds.
     */
    getBundledOngoingProjectsDefaults() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Ongoing Projects',
          lead: 'High-value industrial, utility, and heavy structural contracts across Tamil Nadu and Andhra Pradesh — tracked live by progress, scope, and location.',
          ctaLabel: 'View Active Sites',
          ctaHref: '#ongoing-projects',
          image: 'kochar-warehouse.jpg'
        },
        highlights: [
          { key: 'active', label: 'Active Projects', value: '9', note: 'Live contracts currently under execution' },
          { key: 'tn', label: 'Tamil Nadu', value: '7', note: 'Active sites across Chennai and Kalpakkam' },
          { key: 'ap', label: 'Andhra Pradesh', value: '2', note: 'BARC campus works near Visakhapatnam' }
        ],
        projects: [
          { id: 'ongoing-tn-1', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '1', name: 'Construction of Warehouse 8 Civil works, Ancillary Building and external works in Kochar Industrial Park at Kandamangalam, Tiruvallur Dist - 602105', patron: 'M/S. Kochar Properties Pvt Ltd. Chennai', valueLakhs: '2,926', progress: '25' },
          { id: 'ongoing-tn-3', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '3', name: 'Civil, Structural & Architectural works for foundation & superstructure of various buildings & other miscellaneous structures of Unit # 2 of BTG area at 2x660MW Ennore SEZ STPP (on the ash dyke of NCTPS)', patron: 'BHEL (TNEB) Chennai', valueLakhs: '9,313', progress: '76' },
          { id: 'ongoing-tn-4', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '4', name: 'Construction of 400 MLD SWRO Desalination Plant for CMWSSB at Perur, Chennai.', patron: 'CMWSSB, Chennai', valueLakhs: '6,688', progress: '65' },
          { id: 'ongoing-tn-5', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '5', name: 'Construction of Power Station 2 at FRFCF, DAE, Kalpakkam site', patron: 'FRFCF, DAE, Kalpakkam', valueLakhs: '938', progress: '80' },
          { id: 'ongoing-tn-6', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '6', name: 'Construction of Air Supply, Storage & Exhaust Building for SWPB of CWMF, BARCF at Kalpakkam', patron: 'CWMF, BARCF, Kalpakkam', valueLakhs: '691', progress: '58' },
          { id: 'ongoing-tn-7', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '7', name: 'Construction of Commercial Building B+G+3 at Thoraipakkam', patron: 'M/S. Jain Group Chennai', valueLakhs: '1,505', progress: '28' },
          { id: 'ongoing-tn-8', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '8', name: 'Construction of Hostel Building G+4 for NMV University', patron: 'M/S. Savitha Group of Colleges', valueLakhs: '2,666', progress: '8' },
          { id: 'ongoing-ap-1', region: 'ap', regionLabel: 'Andhra Pradesh', slNo: '1', name: 'Construction of E & F superstructure works of TL-3, finishing works and other miscellaneous works of TL 123 at BARC main campus, Near Visakhapatnam, AP', patron: 'BARC, Vizag', valueLakhs: '1,755', progress: '84' },
          { id: 'ongoing-ap-2', region: 'ap', regionLabel: 'Andhra Pradesh', slNo: '2', name: 'Supply laying installation testing of underground Chilled water pipeline works from UC-1 CAP towards eastern & western side of campus to cover nearby facilities including provision for future expansion at BARC (V), Atchutapuram near Visakhapatnam', patron: 'BARC, Vizag', valueLakhs: '1,380', progress: '25' }
        ]
      };
    }

    _ongoingWithProjectsFallback(data) {
      const bundled = this.getBundledOngoingProjectsDefaults();
      if (!data || typeof data !== 'object') {
        return JSON.parse(JSON.stringify(bundled));
      }
      const projects = Array.isArray(data.projects) ? data.projects : [];
      if (projects.length) return data;
      return Object.assign({}, data, {
        hero: data.hero && (data.hero.title || data.hero.brand) ? data.hero : bundled.hero,
        highlights: Array.isArray(data.highlights) && data.highlights.length ? data.highlights : bundled.highlights,
        projects: bundled.projects.slice()
      });
    }

    getOngoingProjectsContent() {
      if (this.useApi()) {
        return this._ongoingWithProjectsFallback(this._cmsCache.ongoing);
      }
      const stored = this._readLocal('sc_admin_ongoing_projects_v2')
        || this._readLocal('sc_admin_ongoing_projects_v1');
      return this._ongoingWithProjectsFallback(stored);
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

    /**
     * Bundled completed-projects directory for static hosts (GitHub Pages)
     * and API/localStorage misses. Mirrors admin-auth / api seeds.
     */
    getBundledCompletedProjectsDefaults() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Completed Projects',
          lead: 'Since 1995, Sekar Constructions has built an impeccable reputation for executing critical civil engineering structures across India.',
          ctaLabel: 'View Completed Works',
          ctaHref: '#completed-projects',
          image: 'images/completed-projects-hero-kochar.png'
        },
        highlights: [
          { key: 'completed', label: 'Completed Works', value: '12', note: 'Audited major works directory' },
          { key: 'value', label: 'Combined Value', value: '502', note: '₹ Crores across completed major contracts' },
          { key: 'years', label: 'Since', value: '1995', note: 'Class-I civil engineering track record' }
        ],
        projects: [
          { id: 'completed-tn-1', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '1', name: 'Site Development and Compound wall works & Construction of Warehouse (7nos) Civil works, Ancillary Building, external works and Plumbing in Kochar Industrial Park at Kandamangalam, Tiruvallur Dist - 602105', valueLakhs: '10006.62' },
          { id: 'completed-tn-2', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '2', name: 'Construction of On-Site Emergency support centre at Kalpakkam site', valueLakhs: '6080.00' },
          { id: 'completed-tn-3', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '3', name: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri (Civil, PH, storm water drains work and mechanical doors)', valueLakhs: '5630.00' },
          { id: 'completed-tn-4', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '4', name: 'Construction of 150 MLD SWRO Desalination Plant for CMWSSB, Nemmeli on behalf of Cobratecton Pvt. Ltd., Chennai.', valueLakhs: '5232.66' },
          { id: 'completed-tn-5', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '5', name: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam', valueLakhs: '3654.76' },
          { id: 'completed-tn-6', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '6', name: 'Construction of Proposed Factory Building, Warehouse Buildings and Ancillary Building Works including Plumbing at Irungattukottai, Chennai', valueLakhs: '7150.72' },
          { id: 'completed-tn-7', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '7', name: 'Construction of Student Hostel block, Academic block, Ware House, Canteen, Substation, Library, Plumbing work, Sewage Treatment Plant and other miscellaneous work under Phase – III at Great Lakes Institute of Management, Manamai at Kalpakkam.', valueLakhs: '3146.00' },
          { id: 'completed-tn-8', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '8', name: 'Construction of 116 Nos. of type II-B Residential Quarters in DAE Township at Kalpakkam [including electrical work]', valueLakhs: '2583.04' },
          { id: 'completed-tn-9', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '9', name: 'Construction of 233 Nos of New academic block including Civil, Mechanical, Electrical, Public health and other miscellaneous works under Phase - IV at Great Lakes Institute of Management, ECR, Manamai.', valueLakhs: '2357.00' },
          { id: 'completed-tn-10', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '10', name: 'Construction of AUSE Lab Building at IGCAR, Kalpakkam', valueLakhs: '1645.08' },
          { id: 'completed-tn-11', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '11', name: 'Construction of Balance works for 120 nos. of type IIIC quarters (Tower 4 -G+15 story) in DAE Township at Anupuram.', valueLakhs: '1384.33' },
          { id: 'completed-tn-12', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '12', name: 'Construction of Infrastructure facilities for Store and workshop for FRFCF at IGCAR, Kalpakkam on behalf of Consolidated Construction Consortium Ltd, Chennai.', valueLakhs: '1360.00' }
        ]
      };
    }

    _completedWithProjectsFallback(data) {
      const bundled = this.getBundledCompletedProjectsDefaults();
      if (!data || typeof data !== 'object') {
        return JSON.parse(JSON.stringify(bundled));
      }
      const projects = Array.isArray(data.projects) ? data.projects : [];
      if (projects.length) return data;
      return Object.assign({}, data, {
        hero: data.hero && (data.hero.title || data.hero.brand) ? data.hero : bundled.hero,
        highlights: Array.isArray(data.highlights) && data.highlights.length ? data.highlights : bundled.highlights,
        projects: bundled.projects.slice()
      });
    }

    getCompletedProjectsContent() {
      if (this.useApi()) {
        return this._completedWithProjectsFallback(this._cmsCache.completed);
      }
      const stored = this._readLocal('sc_admin_completed_projects_v2')
        || this._readLocal('sc_admin_completed_projects_v1');
      return this._completedWithProjectsFallback(stored);
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

    getBundledProjectGalleryShell() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Project Gallery',
          lead: 'A visual tour of landmark civil works — power, desalination, industrial parks, and institutional campuses across Tamil Nadu.',
          ctaLabel: 'Browse Case Studies',
          ctaHref: '#project-gallery',
          image: 'desalination-plant.jpg'
        },
        highlights: [
          { key: 'studies', label: 'Case Studies', value: '12', note: 'Featured visual project stories' },
          { key: 'sectors', label: 'Sectors', value: '3', note: 'Infrastructure, industrial & commercial' },
          { key: 'years', label: 'Since', value: '1995', note: 'Documented Class-I delivery track record' }
        ],
        items: []
      };
    }

    getProjectGalleryContent() {
      // API mode: merge bundled defaults when hydrate is stale / incomplete.
      if (this.useApi()) {
        const data = this._cmsCache.gallery;
        if (!data || typeof data !== 'object') {
          return this._mergeMissingGalleryDefaults(this.getBundledProjectGalleryShell());
        }
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
          return this._mergeMissingGalleryDefaults(Object.assign({}, this.getBundledProjectGalleryShell(), data, { items: [] }));
        }
        return this._mergeMissingGalleryDefaults(data);
      }
      const stored = this._readLocal('sc_admin_project_gallery_v3')
        || this._readLocal('sc_admin_project_gallery_v2')
        || this._readLocal('sc_admin_project_gallery_v1');
      if (stored && typeof stored === 'object') {
        const items = Array.isArray(stored.items) ? stored.items : [];
        if (!items.length) {
          return this._mergeMissingGalleryDefaults(Object.assign({}, this.getBundledProjectGalleryShell(), stored, { items: [] }));
        }
        return this._mergeMissingGalleryDefaults(stored);
      }
      return this._mergeMissingGalleryDefaults(this.getBundledProjectGalleryShell());
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
