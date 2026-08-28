const crypto = require('crypto');
const config = require('../config');

const CSRF_HEADER = 'x-csrf-token';

function hashCsrfToken(token) {
  return crypto.createHmac('sha256', config.SESSION_SECRET).update(String(token)).digest('hex');
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validateCsrfToken(provided, storedHash) {
  if (!provided || !storedHash) return false;
  const hash = hashCsrfToken(provided);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

module.exports = {
  CSRF_HEADER,
  generateCsrfToken,
  hashCsrfToken,
  validateCsrfToken,
};
