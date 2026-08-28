const express = require('express');

const rateLimit = require('express-rate-limit');

const { z } = require('zod');

const config = require('../config');

const authService = require('../services/authService');

const { validateBody } = require('../middleware/validate');

const { requireAuth, requirePasswordChanged, readSessionToken } = require('../middleware/auth');



const router = express.Router();



const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' },
  },
});

const totpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many two-factor attempts. Try again later.' },
  },
});



function setSessionCookie(res, token, expiresAt) {

  res.cookie(config.COOKIE_NAME, token, {

    httpOnly: true,

    secure: config.COOKIE_SECURE,

    sameSite: config.COOKIE_SAMESITE,

    expires: new Date(expiresAt),

    path: '/',

  });

}



function clearSessionCookie(res) {

  res.clearCookie(config.COOKIE_NAME, {

    httpOnly: true,

    secure: config.COOKIE_SECURE,

    sameSite: config.COOKIE_SAMESITE,

    path: '/',

  });

}



function sessionJson(result) {

  return {

    success: true,

    user: result.user,

    token: result.token,

    csrfToken: result.csrfToken,

    expiresAt: result.expiresAt,

    requires2FA: false,

  };

}



const loginSchema = z.object({

  username: z.string().min(1).max(64),

  password: z.string().min(1).max(256),

});



const verifyTotpSchema = z.object({

  challengeToken: z.string().min(1),

  code: z.string().min(6).max(8),

});



const changePasswordSchema = z.object({

  currentPassword: z.string().min(1).max(256),

  newPassword: z.string().min(12).max(256),

});



const totpEnableSchema = z.object({

  secret: z.string().min(16).max(128),

  code: z.string().min(6).max(8),

});



const totpDisableSchema = z.object({

  password: z.string().min(1).max(256),

  code: z.string().min(6).max(8),

});



router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {

  try {

    const result = await authService.login(req.validated.username, req.validated.password, req);

    if (result.requires2FA) {

      return res.json({

        success: true,

        requires2FA: true,

        challengeToken: result.challengeToken,

        user: result.user,

        message: 'Password verified. Enter your 6-digit authenticator code.',

      });

    }

    setSessionCookie(res, result.token, result.expiresAt);

    res.json(sessionJson(result));

  } catch (err) {

    next(err);

  }

});



router.post('/verify-totp', totpLimiter, validateBody(verifyTotpSchema), async (req, res, next) => {

  try {

    const result = await authService.verifyTotpLogin(

      req.validated.challengeToken,

      req.validated.code,

      req

    );

    setSessionCookie(res, result.token, result.expiresAt);

    res.json(sessionJson(result));

  } catch (err) {

    next(err);

  }

});



router.post('/logout', async (req, res, next) => {

  try {

    const token = readSessionToken(req);

    await authService.logout(token, req);

    clearSessionCookie(res);

    res.json({ success: true });

  } catch (err) {

    next(err);

  }

});



router.get('/csrf', requireAuth, async (req, res, next) => {

  try {

    const csrfToken = await authService.getCsrfTokenForSession(req.sessionRow);

    res.json({ csrfToken });

  } catch (err) {

    next(err);

  }

});



router.get('/me', requireAuth, async (req, res) => {

  res.json({ user: req.admin });

});



router.post('/change-password', requireAuth, validateBody(changePasswordSchema), async (req, res, next) => {

  try {

    const result = await authService.changePassword(

      req.admin.id,

      req.validated.currentPassword,

      req.validated.newPassword,

      req,

      req.sessionToken

    );

    res.json({

      success: true,

      message: `Password updated. ${result.sessionsRevoked} other session(s) signed out.`,

      sessionsRevoked: result.sessionsRevoked,

    });

  } catch (err) {

    next(err);

  }

});



router.get('/totp/setup', requireAuth, requirePasswordChanged, async (req, res, next) => {

  try {

    const setup = await authService.totpSetup(req.admin.id);

    res.json(setup);

  } catch (err) {

    next(err);

  }

});



router.post('/totp/enable', requireAuth, requirePasswordChanged, totpLimiter, validateBody(totpEnableSchema), async (req, res, next) => {
  try {
    const result = await authService.totpEnable(
      req.admin.id,
      req.validated.secret,
      req.validated.code,
      req,
      req.sessionToken
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});



router.post('/totp/disable', requireAuth, requirePasswordChanged, totpLimiter, validateBody(totpDisableSchema), async (req, res, next) => {
  try {
    const result = await authService.totpDisable(
      req.admin.id,
      req.validated.password,
      req.validated.code,
      req,
      req.sessionToken
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});



router.post('/totp/rotate', requireAuth, requirePasswordChanged, totpLimiter, validateBody(totpDisableSchema), async (req, res, next) => {
  try {
    const result = await authService.totpRotate(
      req.admin.id,
      req.validated.password,
      req.validated.code,
      req,
      req.sessionToken
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});



router.get('/audit-logs', requireAuth, requirePasswordChanged, async (req, res, next) => {

  try {

    const logs = await authService.listAuditLogs(Number(req.query.limit) || 100);

    res.json({ logs });

  } catch (err) {

    next(err);

  }

});



module.exports = router;

