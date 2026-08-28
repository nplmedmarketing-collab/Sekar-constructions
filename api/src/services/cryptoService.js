const crypto = require('crypto');
const config = require('../config');

const TOTP_KDF_SALT = 'sekar-totp-aes-v1';
const CHALLENGE_PREFIX = 'sekar-login-challenge-v1';

function deriveTotpKey() {
  return crypto.scryptSync(config.SESSION_SECRET, TOTP_KDF_SALT, 32);
}

/** AES-256-GCM encrypt TOTP base32 secret for storage at rest. */
function encryptTotpSecret(plainSecret) {
  const key = deriveTotpKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainSecret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decryptTotpSecret(stored) {
  if (!stored) return null;
  const buf = Buffer.from(stored, 'base64');
  if (buf.length < 29) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const key = deriveTotpKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function signPayload(payloadObj) {
  const data = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySignedPayload(token, expectedType) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', config.SESSION_SECRET).update(data).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (expectedType && payload.type !== expectedType) return null;
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

/** Short-lived signed token after password step when TOTP is required. */
function createLoginChallenge(userId) {
  return signPayload({
    type: 'login_challenge',
    uid: userId,
    exp: Date.now() + 5 * 60 * 1000,
    n: crypto.randomBytes(16).toString('hex'),
  });
}

function verifyLoginChallenge(token) {
  const payload = verifySignedPayload(token, 'login_challenge');
  if (!payload || !payload.uid) return null;
  return payload;
}

module.exports = {
  encryptTotpSecret,
  decryptTotpSecret,
  createLoginChallenge,
  verifyLoginChallenge,
  CHALLENGE_PREFIX,
};
