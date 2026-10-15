const express = require('express');
const { z } = require('zod');
const content = require('../services/contentService');
const authService = require('../services/authService');
const { requireAuth, requirePasswordChanged } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { isAllowedCtaHref, isAllowedCmsImageSrc } = require('../utils/safeUrl');

const router = express.Router();
router.use(requireAuth);
router.use(requirePasswordChanged);

const ctaHrefSchema = z
  .string()
  .optional()
  .refine((v) => v == null || v === '' || isAllowedCtaHref(v), {
    message: 'ctaHref must be #anchor, relative /path, or https URL',
  });

const heroImageSchema = z
  .string()
  .optional()
  .refine((v) => v == null || v === '' || isAllowedCmsImageSrc(v), {
    message: 'image must be a relative path or https URL',
  });

const heroSchema = z.object({
  brand: z.string().min(1),
  title: z.string().min(1),
  lead: z.string().min(1),
  ctaLabel: z.string().optional(),
  ctaHref: ctaHrefSchema,
  image: heroImageSchema,
});

const highlightSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  note: z.string().optional(),
});

const infraSchema = z.object({
  hero: heroSchema,
  highlights: z.array(highlightSchema).max(3),
  inventory: z.array(z.object({
    id: z.string().optional(),
    category: z.string(),
    categoryLabel: z.string().optional(),
    description: z.string().min(1),
    qty: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
  })),
});

const ongoingSchema = z.object({
  hero: heroSchema,
  highlights: z.array(highlightSchema).max(3),
  projects: z.array(z.object({
    id: z.string().optional(),
    region: z.string(),
    regionLabel: z.string().optional(),
    slNo: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1),
    patron: z.string().optional(),
    valueLakhs: z.union([z.string(), z.number()]),
    progress: z.union([z.string(), z.number()]).optional(),
  })),
});

const completedSchema = z.object({
  hero: heroSchema,
  highlights: z.array(highlightSchema).max(3),
  projects: z.array(z.object({
    id: z.string().optional(),
    region: z.string(),
    regionLabel: z.string().optional(),
    slNo: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1),
    valueLakhs: z.union([z.string(), z.number()]),
  })),
});

const gallerySchema = z.object({
  hero: heroSchema,
  highlights: z.array(highlightSchema).max(3),
  items: z.array(z.object({
    id: z.string().optional(),
    category: z.string(),
    categoryLabel: z.string().optional(),
    categoryFilterLabel: z.string().optional(),
    title: z.string().min(1),
    fullTitle: z.string().optional(),
    client: z.string().optional(),
    value: z.string().optional(),
    valueBadge: z.string().optional(),
    location: z.string().optional(),
    scope: z.string().optional(),
    image: z.string().optional(),
    images: z.array(z.string()).optional(),
    shortDesc: z.string().optional(),
    description: z.string().optional(),
  })),
});

const fleetSchema = z.array(z.object({
  key: z.string().optional(),
  name: z.string().min(1),
  count: z.union([z.string(), z.number()]),
  icon: z.string().optional(),
  logoUrl: z.string().optional(),
  logo_url: z.string().optional(),
}));

const financialsSchema = z.array(z.object({
  key: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  text: z.string(),
  currency: z.string().optional(),
  series: z.array(z.object({
    year: z.string(),
    amount: z.number(),
    source: z.string().optional(),
    visible: z.boolean().optional(),
  })).optional(),
}));

const teamSchema = z.array(z.object({
  id: z.string().optional(),
  url: z.string().min(1),
  caption: z.string().optional(),
}));

const galleryMediaItemSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1),
  title: z.string().optional(),
  badge: z.string().optional(),
  badgeIcon: z.string().optional(),
  location: z.string().optional(),
  locationIcon: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  quote: z.string().optional(),
  meta: z.array(z.object({
    icon: z.string().optional(),
    text: z.string().optional(),
  })).optional(),
});

const galleryMediaSchema = z.array(galleryMediaItemSchema);

const inquiryStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'CONTACTED', 'APPROVED', 'CLOSED', 'REJECTED']),
});

// POST aliases exist because some IIS hosts block PUT before Node (405 Method Not Allowed).
router.route('/infrastructure')
  .put(validateBody(infraSchema), publishInfrastructure)
  .post(validateBody(infraSchema), publishInfrastructure);

async function publishInfrastructure(req, res, next) {
  try {
    const data = await content.putInfrastructure(req.validated);
    await authService.writeAudit('INFRASTRUCTURE_UPDATED', `Published ${data.inventory.length} inventory rows.`, 'INFO', req, req.admin.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.route('/ongoing-projects')
  .put(validateBody(ongoingSchema), publishOngoing)
  .post(validateBody(ongoingSchema), publishOngoing);

async function publishOngoing(req, res, next) {
  try {
    const data = await content.putProjectsPage('ongoing', req.validated);
    await authService.writeAudit('ONGOING_PROJECTS_UPDATED', `Published ${data.projects.length} projects.`, 'INFO', req, req.admin.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.route('/completed-projects')
  .put(validateBody(completedSchema), publishCompleted)
  .post(validateBody(completedSchema), publishCompleted);

async function publishCompleted(req, res, next) {
  try {
    const data = await content.putProjectsPage('completed', req.validated);
    await authService.writeAudit('COMPLETED_PROJECTS_UPDATED', `Published ${data.projects.length} projects.`, 'INFO', req, req.admin.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.route('/gallery')
  .put(validateBody(gallerySchema), publishGallery)
  .post(validateBody(gallerySchema), publishGallery);

async function publishGallery(req, res, next) {
  try {
    const data = await content.putGallery(req.validated);
    await authService.writeAudit('PROJECT_GALLERY_UPDATED', `Published ${data.items.length} case studies.`, 'INFO', req, req.admin.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.route('/fleet')
  .put(validateBody(fleetSchema), publishFleet)
  .post(validateBody(fleetSchema), publishFleet);

async function publishFleet(req, res, next) {
  try {
    const data = await content.putFleet(req.validated);
    await authService.writeAudit('FLEET_INVENTORY_UPDATED', 'Fleet asset inventory updated.', 'INFO', req, req.admin.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.get('/financials', async (req, res, next) => {
  try {
    res.json(await content.getFinancials({ includeHiddenSeries: true }));
  } catch (err) {
    next(err);
  }
});

router.route('/financials')
  .put(validateBody(financialsSchema), publishFinancials)
  .post(validateBody(financialsSchema), publishFinancials);

async function publishFinancials(req, res, next) {
  try {
    const data = await content.putFinancials(req.validated);
    await authService.writeAudit('FINANCIALS_UPDATED', 'Financials updated.', 'INFO', req, req.admin.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.route('/team-photos')
  .put(validateBody(teamSchema), publishTeamPhotos)
  .post(validateBody(teamSchema), publishTeamPhotos);

async function publishTeamPhotos(req, res, next) {
  try {
    const data = await content.putTeamPhotos(req.validated);
    await authService.writeAudit('TEAM_PHOTOS_UPDATED', `Team photos published (${data.length}).`, 'INFO', req, req.admin.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.route('/gallery-media/:section')
  .put(validateBody(galleryMediaSchema), publishGalleryMedia)
  .post(validateBody(galleryMediaSchema), publishGalleryMedia);

async function publishGalleryMedia(req, res, next) {
  try {
    const section = String(req.params.section || '').replace(/-/g, '_');
    const data = await content.putGalleryMedia(section, req.validated);
    await authService.writeAudit(
      'GALLERY_MEDIA_UPDATED',
      `Gallery media published (${section}, ${data.length} items).`,
      'INFO',
      req,
      req.admin.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

router.get('/inquiries', async (req, res, next) => {
  try {
    res.json({ inquiries: await content.getInquiries() });
  } catch (err) {
    next(err);
  }
});

router.patch('/inquiries/:id', validateBody(inquiryStatusSchema), async (req, res, next) => {
  try {
    const inquiry = await content.updateInquiryStatus(req.params.id, req.validated.status);
    await authService.writeAudit('INQUIRY_STATUS_UPDATED', `${req.params.id} → ${req.validated.status}`, 'INFO', req, req.admin.id);
    res.json(inquiry);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
