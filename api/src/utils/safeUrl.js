const config = require('../config');

/**
 * Allow only safe CMS CTA hrefs: in-page anchors, relative paths, https
 * (http allowed in non-production for local Live Server testing).
 */
function isAllowedCtaHref(value) {
  if (value == null || value === '') return true;
  const href = String(value).trim();
  if (!href || href.length > 2048) return false;
  if (/[\r\n\0]/.test(href)) return false;
  const lower = href.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (href.startsWith('#')) return true;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  if (/^https:\/\//i.test(href)) return true;
  if (!config.isProd && /^http:\/\//i.test(href)) return true;
  return false;
}

/**
 * Allow relative CMS image paths or https (http in non-prod). Reject javascript/data.
 */
function isAllowedCmsImageSrc(value) {
  if (value == null || value === '') return true;
  const src = String(value).trim();
  if (!src || src.length > 2048) return false;
  if (/[\r\n\0]/.test(src)) return false;
  const lower = src.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  // Relative path without scheme (e.g. images/foo.jpg)
  if (!/^[a-z][a-z0-9+.-]*:/i.test(src)) return true;
  if (/^https:\/\//i.test(src)) return true;
  if (!config.isProd && /^http:\/\//i.test(src)) return true;
  return false;
}

function assertAllowedCtaHref(href) {
  if (!isAllowedCtaHref(href)) {
    const err = new Error('Invalid CTA link. Use #anchor, /path, or https:// URL.');
    err.status = 400;
    err.code = 'INVALID_CTA_HREF';
    throw err;
  }
}

module.exports = {
  isAllowedCtaHref,
  isAllowedCmsImageSrc,
  assertAllowedCtaHref,
};
