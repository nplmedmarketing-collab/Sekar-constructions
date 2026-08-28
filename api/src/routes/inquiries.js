const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const content = require('../services/contentService');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many inquiries from this IP. Try again later.' },
  },
});

const inquirySchema = z.object({
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional().nullable(),
  email: z.string().email().max(255),
  phone: z.string().max(64).optional().nullable(),
  subject: z.string().min(1).max(512),
  message: z.string().min(1).max(10000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  value: z.string().max(128).optional().nullable(),
});

const emailService = require('../services/emailService');

router.post('/', inquiryLimiter, validateBody(inquirySchema), async (req, res, next) => {
  try {
    const inquiry = await content.createInquiry(req.validated);
    // Non-blocking notification dispatch
    emailService.sendInquiryNotification(inquiry).catch((err) => {
      console.warn('[inquiries] Email dispatch warning:', err.message);
    });
    res.status(201).json({ success: true, inquiry });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
