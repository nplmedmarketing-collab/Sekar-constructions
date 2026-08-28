const authService = require('../services/authService');

const config = require('../config');

const { CSRF_HEADER } = require('../services/csrfService');



/**

 * Prefer Bearer over cookie so SPA Authorization header wins when both are present.

 * Cookie-only auth is still supported for same-site / proxied deployments.

 */

function readSessionToken(req) {

  const header = req.headers.authorization || '';

  if (header.startsWith('Bearer ')) {

    const bearer = header.slice(7).trim();

    if (bearer) {

      req.authVia = 'bearer';

      return bearer;

    }

  }

  const cookie = req.cookies && req.cookies[config.COOKIE_NAME];

  if (cookie) {

    req.authVia = 'cookie';

    return cookie;

  }

  req.authVia = null;

  return null;

}



function originAllowed(origin) {

  if (!origin) return false;

  return config.CORS_ORIGINS.includes(origin);

}



/**

 * Cookie sessions + SameSite=None (cross-origin admin) are CSRF-prone.

 * Layer 1: allowlisted Origin / Referer.

 * Layer 2: X-CSRF-Token must match the session-bound token (issued at login / GET /csrf).

 * Bearer-authenticated requests skip CSRF (not vulnerable to classic cross-site form POST).

 */

async function assertCookieCsrfAsync(req, res) {
  if (req.authVia !== 'cookie') return true;

  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  const origin = req.headers.origin;
  if (!originAllowed(origin)) {
    const referer = req.headers.referer || req.headers.referrer;
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (!originAllowed(refOrigin)) {
          res.status(403).json({
            error: {
              code: 'CSRF_DENIED',
              message: 'Cookie-authenticated mutations require an allowlisted Origin.',
            },
          });
          return false;
        }
      } catch {
        res.status(403).json({
          error: {
            code: 'CSRF_DENIED',
            message: 'Cookie-authenticated mutations require an allowlisted Origin.',
          },
        });
        return false;
      }
    } else {
      res.status(403).json({
        error: {
          code: 'CSRF_DENIED',
          message: 'Cookie-authenticated mutations require an allowlisted Origin.',
        },
      });
      return false;
    }
  }

  const csrfHeader = req.headers[CSRF_HEADER] || req.headers['X-CSRF-Token'];
  if (!csrfHeader || !req.sessionRow) {
    res.status(403).json({
      error: {
        code: 'CSRF_TOKEN_REQUIRED',
        message: 'Send X-CSRF-Token header matching the session token from login or GET /api/auth/csrf.',
      },
    });
    return false;
  }

  const csrfValid = await authService.validateSessionCsrf(req.sessionRow, csrfHeader);
  if (!csrfValid) {
    res.status(403).json({
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or expired CSRF token. Call GET /api/auth/csrf and retry.',
      },
    });
    return false;
  }

  return true;
}



async function requireAuth(req, res, next) {

  try {

    const token = readSessionToken(req);

    const resolved = await authService.resolveSession(token);

    if (!resolved) {

      return res.status(401).json({

        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },

      });

    }

    req.sessionRow = resolved.session;

    req.admin = resolved.user;

    req.sessionToken = token;

    if (!(await assertCookieCsrfAsync(req, res))) return;

    return next();

  } catch (err) {

    return next(err);

  }

}



/** Block CMS / privileged reads until seed password is rotated. */

function requirePasswordChanged(req, res, next) {

  if (req.admin && req.admin.mustChangePassword) {

    return res.status(403).json({

      error: {

        code: 'PASSWORD_CHANGE_REQUIRED',

        message: 'Change your password before using admin APIs.',

      },

    });

  }

  return next();

}



module.exports = {

  requireAuth,

  requirePasswordChanged,

  readSessionToken,

};

