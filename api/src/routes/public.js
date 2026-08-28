const express = require('express');
const content = require('../services/contentService');

const router = express.Router();

router.get('/infrastructure', async (req, res, next) => {
  try {
    const data = await content.getInfrastructure();
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Infrastructure content missing.' } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/ongoing-projects', async (req, res, next) => {
  try {
    const data = await content.getProjectsPage('ongoing');
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ongoing projects missing.' } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/completed-projects', async (req, res, next) => {
  try {
    const data = await content.getProjectsPage('completed');
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Completed projects missing.' } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/gallery', async (req, res, next) => {
  try {
    const data = await content.getGallery();
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Gallery content missing.' } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/fleet', async (req, res, next) => {
  try {
    res.json(await content.getFleet());
  } catch (err) {
    next(err);
  }
});

router.get('/financials', async (req, res, next) => {
  try {
    res.json(await content.getFinancials());
  } catch (err) {
    next(err);
  }
});

router.get('/team-photos', async (req, res, next) => {
  try {
    res.json(await content.getTeamPhotos());
  } catch (err) {
    next(err);
  }
});

router.get('/gallery-media', async (req, res, next) => {
  try {
    res.json(await content.getAllGalleryMedia());
  } catch (err) {
    next(err);
  }
});

router.get('/gallery-media/:section', async (req, res, next) => {
  try {
    const section = String(req.params.section || '').replace(/-/g, '_');
    res.json(await content.getGalleryMedia(section));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
