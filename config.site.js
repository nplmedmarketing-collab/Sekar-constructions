/**
 * Sekar Construction — site / API configuration
 *
 * Explicit override (set before this script loads):
 *   window.SekarConfig = {
 *     apiBaseUrl: 'https://YOUR-API.onrender.com',  // no trailing slash
 *     jobsSiteUrl: 'https://jobs.sekarconstructions.com'
 *   };
 *
 * Defaults:
 * - Local (localhost / 127.0.0.1 / file://): apiBaseUrl → http://127.0.0.1:3001
 * - github.io: apiBaseUrl → REMOTE_API_BASE below (NOT window.location.origin — Pages has no Node API)
 * - Other production hosts: apiBaseUrl → window.location.origin (same-origin /api reverse-proxy)
 * - jobsSiteUrl → https://jobs.sekarconstructions.com (optional dedicated careers host)
 * - useJobsSite → false by default (nav stays on relative careers.html). Set true only
 *   after jobs.sekarconstructions.com DNS + hosting are live.
 *
 * Careers on jobs.sekarconstructions.com (when useJobsSite is true):
 * - Recommended: reverse-proxy /api on that host to the Node API → leave apiBaseUrl as origin.
 * - Alternative: set apiBaseUrl to the API host and list the jobs origin in API CORS_ORIGINS.
 *
 * GitHub Pages + remote API: see api/DEPLOY-GITHUB-PAGES.md
 */
(function () {
  /**
   * Set this AFTER deploying the Node API (Render / Railway / VPS).
   * Example: 'https://sekar-api.onrender.com'
   * Leave empty until the API is live — do not invent a URL.
   * Required for admin login on *.github.io (Pages cannot host /api/*).
   */
  var REMOTE_API_BASE = '';

  var hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
  var isLocal = typeof window !== 'undefined' && (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  );
  var isGitHubPages = /\.github\.io$/i.test(hostname);

  var defaultBase;
  if (isLocal) {
    defaultBase = 'http://127.0.0.1:3001';
  } else if (REMOTE_API_BASE) {
    defaultBase = String(REMOTE_API_BASE).replace(/\/$/, '');
  } else if (isGitHubPages) {
    // github.io has no Node process — empty base disables API until REMOTE_API_BASE is set.
    defaultBase = '';
  } else {
    defaultBase = typeof window !== 'undefined' ? window.location.origin : '';
  }

  window.SekarConfig = Object.assign({
    apiBaseUrl: defaultBase,
    jobsSiteUrl: 'https://jobs.sekarconstructions.com',
    useJobsSite: false
  }, window.SekarConfig || {});
})();
