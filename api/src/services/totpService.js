const { authenticator } = require('otplib');
const cryptoService = require('./cryptoService');

authenticator.options = { window: 1 };

function generateSecret() {
  return authenticator.generateSecret(20);
}

function buildOtpauthUrl(username, secret) {
  const label = encodeURIComponent(`Sekar Construction:${username || 'admin'}`);
  const issuer = encodeURIComponent('Sekar Construction');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

function qrImageUrl(otpauthUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
}

function normalizeTotpCode(code) {
  return String(code || '').replace(/\s/g, '');
}

/** Current 30s time-step counter (Unix epoch / 30). */
function counterForDelta(delta) {
  const epoch = Math.floor(Date.now() / 1000);
  return Math.floor(epoch / 30) + delta;
}

function getVerifiedCounter(code, plainSecret) {
  if (!code || !plainSecret) return null;
  const normalized = normalizeTotpCode(code);
  if (!/^\d{6}$/.test(normalized)) return null;
  try {
    const delta = authenticator.checkDelta(normalized, plainSecret);
    if (delta === null || delta === undefined) return null;
    return counterForDelta(delta);
  } catch {
    return null;
  }
}

function verifyCode(code, plainSecret) {
  return getVerifiedCounter(code, plainSecret) !== null;
}

function verifyStoredCode(code, encryptedSecret) {
  const plain = cryptoService.decryptTotpSecret(encryptedSecret);
  if (!plain) return false;
  return verifyCode(code, plain);
}

/**
 * Verify TOTP and return the accepted time-step counter (for replay tracking).
 * Does not persist — caller updates totp_last_step after success.
 */
function getVerifiedCounterFromStored(code, encryptedSecret) {
  const plain = cryptoService.decryptTotpSecret(encryptedSecret);
  if (!plain) return null;
  return getVerifiedCounter(code, plain);
}

module.exports = {
  generateSecret,
  buildOtpauthUrl,
  qrImageUrl,
  normalizeTotpCode,
  verifyCode,
  verifyStoredCode,
  getVerifiedCounter,
  getVerifiedCounterFromStored,
};
