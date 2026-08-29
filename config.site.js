/**
 * Sekar Construction — site / API configuration
 *
 * Explicit override (set before this script loads):
 *   window.SekarConfig = {
 *     apiBaseUrl: 'https://www.sekarconstructions.com',  // or https://api.…
 *     jobsSiteUrl: 'https://jobs.sekarconstructions.com'
 *   };
 *
 * Defaults:
 * - Local (localhost / 127.0.0.1 / file://): apiBaseUrl → http://127.0.0.1:3001
 * - Production: apiBaseUrl → window.location.origin (same-origin /api reverse-proxy)
 * - jobsSiteUrl → https://jobs.sekarconstructions.com (public careers host)
 *
 * Careers on jobs.sekarconstructions.com:
 * - Recommended: reverse-proxy /api on that host to the Node API → leave apiBaseUrl as origin.
 * - Alternative: set apiBaseUrl to https://www.sekarconstructions.com (or api subdomain)
 *   and list https://jobs.sekarconstructions.com in API CORS_ORIGINS.
 */
(function () {
  var isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  );
  var defaultBase = isLocal ? 'http://127.0.0.1:3001' : (typeof window !== 'undefined' ? window.location.origin : '');
  window.SekarConfig = Object.assign({
    apiBaseUrl: defaultBase,
    jobsSiteUrl: 'https://jobs.sekarconstructions.com'
  }, window.SekarConfig || {});
})();
