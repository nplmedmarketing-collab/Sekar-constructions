const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const hrpops = require('../services/hrpopsService');
const emailService = require('../services/emailService');

const router = express.Router();

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many applications from this IP. Try again later.' },
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

router.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await hrpops.listJobs();
    res.json({
      jobs,
      companyId: hrpops.getCompanyId(),
      inlineApply: hrpops.usesInlineApply(),
      applyPortalUrl: hrpops.getApplyPortalUrl() || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:jobPostId', async (req, res, next) => {
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

router.get('/countries', async (req, res, next) => {
  try {
    const countries = await hrpops.listCountries();
    res.json({ countries });
  } catch (err) {
    next(err);
  }
});

router.get('/states/:countryId', async (req, res, next) => {
  try {
    const states = await hrpops.listStates(req.params.countryId);
    res.json({ states });
  } catch (err) {
    next(err);
  }
});

router.get('/cities/:stateId', async (req, res, next) => {
  try {
    const cities = await hrpops.listCities(req.params.stateId);
    res.json({ cities });
  } catch (err) {
    next(err);
  }
});

router.post('/apply', applyLimiter, applyUploadMiddleware, async (req, res, next) => {
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
    if (!email) {
      console.warn(
        '[careers] Apply succeeded but candidate Email field is empty — thank-you cannot be sent. ' +
          'Multipart must include Email (or email).'
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

    try {
      Promise.resolve(emailService.sendApplicationThankYou(mailPayload))
        .then((result) => logMailOutcome('Thank-you email', result))
        .catch((err) => {
          console.warn('[careers] Thank-you email warning:', err && err.message ? err.message : err);
        });
    } catch (err) {
      console.warn('[careers] Thank-you email warning:', err && err.message ? err.message : err);
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
