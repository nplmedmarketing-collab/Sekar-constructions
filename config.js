/**
 * Sekar Construction — site / API configuration
 *
 * Explicit override: Set window.SekarConfig = { apiBaseUrl: 'https://api.sekarconstructions.com' } before loading this script.
 * Default (Local dev): Falls back to http://127.0.0.1:3001 on localhost / 127.0.0.1 / file://.
 * Default (Production same-domain reverse-proxy): Defaults to current origin (window.location.origin).
 */
(function () {
  var isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  );
  var defaultBase = isLocal ? 'http://127.0.0.1:3001' : (typeof window !== 'undefined' ? window.location.origin : '');
  window.SekarConfig = Object.assign({
    apiBaseUrl: defaultBase
  }, window.SekarConfig || {});
})();
