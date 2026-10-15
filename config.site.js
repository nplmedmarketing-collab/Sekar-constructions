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
 * - Local: http://127.0.0.1:3001
 * - *.sekarconstructions.com: same-origin (PHP bridges /api → Node API)
 * - github.io: REMOTE_API_BASE
 * - Else: REMOTE_API_BASE if set, otherwise origin
 */
(function () {
  var REMOTE_API_BASE = 'https://api.sekarconstructions.com';

  var hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
  var isLocal = typeof window !== 'undefined' && (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  );
  var isGitHubPages = /\.github\.io$/i.test(hostname);
  var isSekarHost = /(^|\.)sekarconstructions\.com$/i.test(hostname);

  var defaultBase;
  if (isLocal) {
    defaultBase = 'http://127.0.0.1:3001';
  } else if (isSekarHost) {
    defaultBase = typeof window !== 'undefined' ? window.location.origin : '';
  } else if (isGitHubPages) {
    defaultBase = REMOTE_API_BASE ? String(REMOTE_API_BASE).replace(/\/$/, '') : '';
  } else if (REMOTE_API_BASE) {
    defaultBase = String(REMOTE_API_BASE).replace(/\/$/, '');
  } else {
    defaultBase = typeof window !== 'undefined' ? window.location.origin : '';
  }

  window.SekarConfig = Object.assign({
    apiBaseUrl: defaultBase,
    jobsSiteUrl: 'https://jobs.sekarconstructions.com',
    useJobsSite: false
  }, window.SekarConfig || {});
})();
