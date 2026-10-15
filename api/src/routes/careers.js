const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const hrpops = require('../services/hrpopsService');
const emailService = require('../services/emailService');

const router = express.Router();

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many applications from this IP. Try again later.' },
  },
});

/** Per-email apply throttle (hash key — avoids storing raw emails in limiter memory long-term). */
const applyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String((req.body && (req.body.Email || req.body.email)) || '')
      .trim()
      .toLowerCase();
    const emailKey = email
      ? crypto.createHash('sha256').update(email).digest('hex').slice(0, 32)
      : 'noemail';
    return `${req.ip}:${emailKey}`;
  },
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many applications for this email. Try again later.' },
  },
});

const careersGetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many career catalog requests from this IP. Try again later.' },
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
});

const applyUpload = upload.fields([
  { name: 'Resume', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'ProfilePic', maxCount: 1 },
  { name: 'profilePic', maxCount: 1 },
]);

function applyUploadMiddleware(req, res, next) {
  applyUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      let message = 'File upload failed.';
      if (err.code === 'LIMIT_FILE_SIZE') message = 'Uploaded file is too large (max 5MB).';
      else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        message = `Unexpected file field "${err.field}". Use Resume and ProfilePic.`;
      } else if (err.message) message = err.message;
      const wrapped = new Error(message);
      wrapped.status = 400;
      wrapped.code = 'UPLOAD_ERROR';
      return next(wrapped);
    }
    return next(err);
  });
}

function pickFile(files, ...names) {
  if (!files) return null;
  for (const name of names) {
    if (files[name] && files[name][0]) return files[name][0];
  }
  return null;
}

let jobsListCache = { at: 0, payload: null };
const JOBS_CACHE_MS = 60 * 1000;

router.get('/jobs', careersGetLimiter, async (req, res, next) => {
  try {
    const now = Date.now();
    if (jobsListCache.payload && now - jobsListCache.at < JOBS_CACHE_MS) {
      return res.json(jobsListCache.payload);
    }
    const jobs = await hrpops.listJobs();
    const payload = {
      jobs,
      companyId: hrpops.getCompanyId(),
      inlineApply: hrpops.usesInlineApply(),
      applyPortalUrl: hrpops.getApplyPortalUrl() || null,
    };
    jobsListCache = { at: now, payload };
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:jobPostId', careersGetLimiter, async (req, res, next) => {
  try {
    const job = await hrpops.getJob(req.params.jobPostId);
    if (!job) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job opening not found.' } });
    }
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

router.get('/countries', careersGetLimiter, async (req, res, next) => {
  try {
    const countries = await hrpops.listCountries();
    res.json({ countries });
  } catch (err) {
    next(err);
  }
});

router.get('/states/:countryId', careersGetLimiter, async (req, res, next) => {
  try {
    const states = await hrpops.listStates(req.params.countryId);
    res.json({ states });
  } catch (err) {
    next(err);
  }
});

router.get('/cities/:stateId', careersGetLimiter, async (req, res, next) => {
  try {
    const cities = await hrpops.listCities(req.params.stateId);
    res.json({ cities });
  } catch (err) {
    next(err);
  }
});

router.post('/apply', applyLimiter, applyUploadMiddleware, applyEmailLimiter, async (req, res, next) => {
  try {
    const body = req.body || {};
    const resume = pickFile(req.files, 'Resume', 'resume');
    const profilePic = pickFile(req.files, 'ProfilePic', 'profilePic');

    if (!resume) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Resume file is required.' } });
    }
    if (!profilePic) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Profile photo is required.' } });
    }

    const result = await hrpops.apply({
      fields: body,
      resume,
      profilePic,
      skillsRating: body.skillsRating,
      languagesJson: body.LanguagesJson,
    });

    const email = String(body.Email || body.email || '').trim();
    const candidateName = String(body.CandidateName || body.name || '').trim();
    let jobTitle = String(body.JobTitle || body.jobTitle || '').trim();

    if (!jobTitle && body.JobPostID) {
      try {
        const job = await hrpops.getJob(body.JobPostID);
        if (job && job.title) jobTitle = job.title;
      } catch (_err) {
        // Title is optional for the thank-you email; ignore lookup failures.
      }
    }

    // Non-blocking — SMTP / missing export / sync throw must never fail apply.
    const mailPayload = { email, candidateName, jobTitle };
    const emailOk = emailService.isStrictEmail(email);

    if (!email) {
      console.warn(
        '[careers] Apply succeeded but candidate Email field is empty — thank-you cannot be sent. ' +
          'Multipart must include Email (or email).'
      );
    } else if (!emailOk) {
      console.warn(
        `[careers] Apply succeeded but candidate email failed strict validation — thank-you skipped (${email}).`
      );
    } else {
      console.log(
        `[careers] Apply succeeded — queueing thank-you + HR alert for ${email}` +
          (jobTitle ? ` (${jobTitle})` : '')
      );
    }

    const logMailOutcome = (label, result) => {
      if (result && result.sent) {
        console.log(`[careers] ${label}: sent.`);
        return;
      }
      const reason = (result && (result.reason || result.error)) || 'unknown';
      console.warn(
        `[careers] ${label}: SKIPPED after successful apply ` +
          `(candidate=${email || '(empty)'}, job=${jobTitle || 'n/a'}): ${reason}. ` +
          'Set SMTP_HOST, SMTP_USER, and SMTP_PASS in api/.env to enable email.'
      );
    };

    if (emailOk) {
      try {
        Promise.resolve(emailService.sendApplicationThankYou(mailPayload))
          .then((result) => logMailOutcome('Thank-you email', result))
          .catch((err) => {
            console.warn('[careers] Thank-you email warning:', err && err.message ? err.message : err);
          });
      } catch (err) {
        console.warn('[careers] Thank-you email warning:', err && err.message ? err.message : err);
      }
    }
    try {
      Promise.resolve(emailService.sendApplicationHrNotification(mailPayload))
        .then((result) => logMailOutcome('HR alert email', result))
        .catch((err) => {
          console.warn('[careers] HR alert email warning:', err && err.message ? err.message : err);
        });
    } catch (err) {
      console.warn('[careers] HR alert email warning:', err && err.message ? err.message : err);
    }

    res.status(201).json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
