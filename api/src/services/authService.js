const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const cryptoService = require('./cryptoService');
const totpService = require('./totpService');
const csrfService = require('./csrfService');
const backupCodeService = require('./backupCodeService');

const BCRYPT_ROUNDS = 12;
const TOTP_LOCK_PREFIX = 'totp:';
// Fixed dummy hash so unknown-user path still runs bcrypt.compare (timing parity).
const DUMMY_PASSWORD_HASH =
  '$2b$12$G4N8t.PEd710n3KlrRaFou432s/WHndb8T80zc2PW9vcZnfamw61W';

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function invalidCredentialsError() {
  const err = new Error('Invalid username or password.');
  err.status = 401;
  err.code = 'INVALID_CREDENTIALS';
  return err;
}

async function purgeExpiredLoginChallenges() {
  try {
    await db('login_challenges').where('expires_at', '<', db.fn.now()).del();
  } catch {
    /* table may not exist until migrate */
  }
}

async function persistLoginChallenge(userId, challengeToken) {
  const challengeHash = cryptoService.hashChallengeToken(challengeToken);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await purgeExpiredLoginChallenges();
  await db('login_challenges').insert({
    challenge_hash: challengeHash,
    user_id: userId,
    expires_at: expiresAt,
    used_at: null,
  });
}

/**
 * Load unused, unexpired challenge for token. Does not mark used.
 */
async function getActiveLoginChallenge(challengeToken) {
  const payload = cryptoService.verifyLoginChallenge(challengeToken);
  if (!payload) return null;
  const challengeHash = cryptoService.hashChallengeToken(challengeToken);
  const row = await db('login_challenges')
    .where({ challenge_hash: challengeHash })
    .whereNull('used_at')
    .where('expires_at', '>', db.fn.now())
    .first();
  if (!row) return null;
  return { payload, challengeHash, row };
}

/** Atomically mark challenge used; 0 rows = already used / missing. */
async function markLoginChallengeUsed(challengeHash) {
  const updated = await db('login_challenges')
    .where({ challenge_hash: challengeHash })
    .whereNull('used_at')
    .update({ used_at: db.fn.now() });
  return updated === 1;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function writeAudit(event, details, level, req, userId = null) {
  let uid = null;
  if (userId) {
    const userExists = await db('admin_users').where({ id: userId }).first();
    if (userExists) uid = userExists.id;
  }
  await db('audit_logs').insert({
    event,
    details,
    level: level || 'INFO',
    ip: req ? clientIp(req) : null,
    user_id: uid,
  });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    mustChangePassword: Boolean(user.must_change_password),
    totpEnabled: Boolean(user.totp_enabled),
  };
}

async function getLockout(username) {
  return db('admin_lockouts').where({ username }).first();
}

async function isLocked(username) {
  const row = await getLockout(username);
  if (!row || !row.locked_until) return { locked: false, attempts: row ? row.attempts : 0 };
  const until = new Date(row.locked_until).getTime();
  if (Date.now() > until) {
    await db('admin_lockouts').where({ username }).update({
      attempts: 0,
      locked_until: null,
      updated_at: db.fn.now(),
    });
    return { locked: false, attempts: 0 };
  }
  return {
    locked: true,
    attempts: row.attempts,
    unlockTime: until,
    remainingMinutes: Math.ceil((until - Date.now()) / 60000),
  };
}

async function recordFailedAttempt(username, req) {
  const existing = await getLockout(username);
  const attempts = (existing ? existing.attempts : 0) + 1;
  let lockedUntil = null;
  if (attempts >= config.MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + config.LOCKOUT_MINUTES * 60 * 1000);
  }
  if (existing) {
    await db('admin_lockouts').where({ username }).update({
      attempts,
      locked_until: lockedUntil,
      updated_at: db.fn.now(),
    });
  } else {
    await db('admin_lockouts').insert({
      username,
      attempts,
      locked_until: lockedUntil,
      updated_at: db.fn.now(),
    });
  }
  await writeAudit(
    lockedUntil ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
    lockedUntil
      ? `Too many failed attempts. Locked for ${config.LOCKOUT_MINUTES} minutes.`
      : `Invalid credential attempt (${attempts}/${config.MAX_FAILED_ATTEMPTS}).`,
    lockedUntil ? 'CRITICAL' : 'WARNING',
    req
  );
  return { attempts, locked: Boolean(lockedUntil), remainingMinutes: config.LOCKOUT_MINUTES };
}

async function clearLockout(username) {
  await db('admin_lockouts').where({ username }).del();
}

function totpLockKey(username) {
  return TOTP_LOCK_PREFIX + String(username || '').toLowerCase().trim();
}

async function isTotpLocked(username) {
  const row = await getLockout(totpLockKey(username));
  if (!row || !row.locked_until) return { locked: false, attempts: row ? row.attempts : 0 };
  const until = new Date(row.locked_until).getTime();
  if (Date.now() > until) {
    await db('admin_lockouts').where({ username: totpLockKey(username) }).update({
      attempts: 0,
      locked_until: null,
      updated_at: db.fn.now(),
    });
    return { locked: false, attempts: 0 };
  }
  return {
    locked: true,
    attempts: row.attempts,
    remainingMinutes: Math.ceil((until - Date.now()) / 60000),
  };
}

async function recordTotpFailedAttempt(username, req, userId = null) {
  const key = totpLockKey(username);
  const existing = await getLockout(key);
  const attempts = (existing ? existing.attempts : 0) + 1;
  let lockedUntil = null;
  if (attempts >= config.MAX_TOTP_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + config.TOTP_LOCKOUT_MINUTES * 60 * 1000);
  }
  if (existing) {
    await db('admin_lockouts').where({ username: key }).update({
      attempts,
      locked_until: lockedUntil,
      updated_at: db.fn.now(),
    });
  } else {
    await db('admin_lockouts').insert({
      username: key,
      attempts,
      locked_until: lockedUntil,
      updated_at: db.fn.now(),
    });
  }
  await writeAudit(
    lockedUntil ? 'TOTP_LOCKED' : 'TOTP_FAILED',
    lockedUntil
      ? `Too many invalid TOTP attempts. Locked for ${config.TOTP_LOCKOUT_MINUTES} minutes.`
      : `Invalid TOTP attempt (${attempts}/${config.MAX_TOTP_FAILED_ATTEMPTS}).`,
    lockedUntil ? 'CRITICAL' : 'WARNING',
    req,
    userId
  );
  return { attempts, locked: Boolean(lockedUntil), remainingMinutes: config.TOTP_LOCKOUT_MINUTES };
}

async function clearTotpLockout(username) {
  await db('admin_lockouts').where({ username: totpLockKey(username) }).del();
}

/**
 * Verify TOTP against stored secret with ±1 step window and atomic replay protection.
 * Conditional UPDATE: 0 rows means race/replay → failure.
 * Returns { ok: true, counter } or { ok: false, reason }.
 */
async function verifyAndConsumeStoredTotp(user, code) {
  if (!user || !user.totp_secret) {
    return { ok: false, reason: 'NOT_CONFIGURED' };
  }
  const counter = totpService.getVerifiedCounterFromStored(code, user.totp_secret);
  if (counter === null) {
    return { ok: false, reason: 'INVALID' };
  }
  const lastStep = user.totp_last_step != null ? Number(user.totp_last_step) : null;
  if (lastStep !== null && counter <= lastStep) {
    return { ok: false, reason: 'REPLAY' };
  }
  // Atomic: only succeed if totp_last_step is still null or strictly less than counter.
  const q = db('admin_users').where({ id: user.id });
  if (lastStep === null) {
    q.whereNull('totp_last_step');
  } else {
    q.where('totp_last_step', lastStep);
  }
  const updated = await q.update({
    totp_last_step: counter,
    updated_at: db.fn.now(),
  });
  if (updated !== 1) {
    return { ok: false, reason: 'REPLAY' };
  }
  return { ok: true, counter };
}

async function createSession(user, req) {
  const token = uuidv4() + '.' + crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(token);
  const csrfToken = csrfService.generateCsrfToken();
  const csrfTokenHash = csrfService.hashCsrfToken(csrfToken);
  const expiresAt = new Date(Date.now() + config.SESSION_HOURS * 60 * 60 * 1000);

  await db('admin_sessions').insert({
    user_id: user.id,
    token_hash: tokenHash,
    csrf_token_hash: csrfTokenHash,
    expires_at: expiresAt,
    ip: clientIp(req),
    user_agent: (req.headers['user-agent'] || '').slice(0, 512),
  });

  return { token, csrfToken, expiresAt, user: publicUser(user) };
}

async function verifyPassword(username, password, req) {
  const userClean = String(username || '').toLowerCase().trim();
  const pwd = String(password || '');

  if (!userClean || !pwd) {
    const err = new Error('Username and password are required.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const lock = await isLocked(userClean);
  if (lock.locked) {
    const err = new Error(
      `Account locked due to repeated failed attempts. Try again in ${lock.remainingMinutes} minute(s).`
    );
    err.status = 423;
    err.code = 'ACCOUNT_LOCKED';
    err.locked = true;
    err.remainingMinutes = lock.remainingMinutes;
    throw err;
  }

  const user = await db('admin_users').whereRaw('LOWER(username) = ?', [userClean]).first();
  const hash = user ? user.password_hash : DUMMY_PASSWORD_HASH;
  const ok = await bcrypt.compare(pwd, hash);

  if (!user || !ok) {
    const fail = await recordFailedAttempt(userClean, req);
    if (fail.locked) {
      const err = new Error(
        `Account locked due to repeated failed attempts. Try again in ${fail.remainingMinutes} minute(s).`
      );
      err.status = 423;
      err.code = 'ACCOUNT_LOCKED';
      err.locked = true;
      err.remainingMinutes = fail.remainingMinutes;
      throw err;
    }
    throw invalidCredentialsError();
  }

  await clearLockout(userClean);
  return user;
}

async function login(username, password, req) {
  const user = await verifyPassword(username, password, req);

  if (user.totp_enabled && user.totp_secret) {
    const challengeToken = cryptoService.createLoginChallenge(user.id);
    await persistLoginChallenge(user.id, challengeToken);
    await writeAudit('LOGIN_PASSWORD_OK', 'Password verified; awaiting TOTP.', 'INFO', req, user.id);
    return {
      requires2FA: true,
      challengeToken,
      user: publicUser(user),
    };
  }

  const session = await createSession(user, req);
  await writeAudit('LOGIN_SUCCESS', 'Admin authenticated with password.', 'INFO', req, user.id);
  return {
    requires2FA: false,
    ...session,
  };
}

async function verifyTotpLogin(challengeToken, code, req) {
  const active = await getActiveLoginChallenge(challengeToken);
  if (!active) {
    const err = new Error('Login challenge expired or invalid. Sign in again with your password.');
    err.status = 401;
    err.code = 'INVALID_CHALLENGE';
    throw err;
  }

  const user = await db('admin_users').where({ id: active.payload.uid }).first();
  if (!user || !user.totp_enabled || !user.totp_secret) {
    const err = new Error('Login challenge expired or invalid. Sign in again with your password.');
    err.status = 401;
    err.code = 'INVALID_CHALLENGE';
    throw err;
  }

  const totpLock = await isTotpLocked(user.username);
  if (totpLock.locked) {
    const err = new Error(
      `Too many invalid authenticator attempts. Try again in ${totpLock.remainingMinutes} minute(s).`
    );
    err.status = 423;
    err.code = 'TOTP_LOCKED';
    throw err;
  }

  const normalized = totpService.normalizeTotpCode(code);
  let totpReady = false;

  // Soft-verify TOTP first (no consume) so a wrong code can be retried on the same challenge,
  // and concurrent double-submits don't both burn the authenticator code.
  if (/^\d{6}$/.test(normalized)) {
    const counter = totpService.getVerifiedCounterFromStored(normalized, user.totp_secret);
    if (counter !== null) {
      const lastStep = user.totp_last_step != null ? Number(user.totp_last_step) : null;
      if (lastStep !== null && counter <= lastStep) {
        await recordTotpFailedAttempt(user.username, req, user.id);
        const err = new Error('Authenticator code already used. Wait for the next code.');
        err.status = 401;
        err.code = 'TOTP_REPLAY';
        throw err;
      }
      totpReady = true;
    }
  }

  const looksLikeBackup = !totpReady && String(code || '').replace(/\s/g, '').length >= 8;

  if (!totpReady && !looksLikeBackup) {
    const fail = await recordTotpFailedAttempt(user.username, req, user.id);
    if (fail.locked) {
      const err = new Error(`Too many invalid authenticator attempts. Locked for ${fail.remainingMinutes} minutes.`);
      err.status = 423;
      err.code = 'TOTP_LOCKED';
      throw err;
    }
    const err = new Error('Invalid authenticator or backup code.');
    err.status = 401;
    err.code = 'INVALID_TOTP';
    throw err;
  }

  // Claim challenge atomically — only one concurrent verify may proceed.
  const consumed = await markLoginChallengeUsed(active.challengeHash);
  if (!consumed) {
    const err = new Error('Login challenge expired or invalid. Sign in again with your password.');
    err.status = 401;
    err.code = 'INVALID_CHALLENGE';
    throw err;
  }

  let verified = false;

  if (totpReady) {
    const result = await verifyAndConsumeStoredTotp(user, normalized);
    if (result.ok) {
      verified = true;
    } else if (result.reason === 'REPLAY') {
      await recordTotpFailedAttempt(user.username, req, user.id);
      const err = new Error('Authenticator code already used. Wait for the next code.');
      err.status = 401;
      err.code = 'TOTP_REPLAY';
      throw err;
    }
  }

  if (!verified) {
    const backupOk = await backupCodeService.consumeBackupCode(user.id, code);
    if (backupOk) {
      verified = true;
      await writeAudit('BACKUP_CODE_USED', 'Single-use backup code consumed at login.', 'CRITICAL', req, user.id);
    }
  }

  if (!verified) {
    const fail = await recordTotpFailedAttempt(user.username, req, user.id);
    if (fail.locked) {
      const err = new Error(`Too many invalid authenticator attempts. Locked for ${fail.remainingMinutes} minutes.`);
      err.status = 423;
      err.code = 'TOTP_LOCKED';
      throw err;
    }
    const err = new Error('Invalid authenticator or backup code.');
    err.status = 401;
    err.code = 'INVALID_TOTP';
    throw err;
  }

  await clearTotpLockout(user.username);
  const session = await createSession(user, req);
  await writeAudit('LOGIN_SUCCESS', 'Admin authenticated with password + TOTP.', 'INFO', req, user.id);
  return {
    requires2FA: false,
    ...session,
  };
}

async function logout(token, req) {
  if (!token) return;
  const tokenHash = hashToken(token);
  const session = await db('admin_sessions').where({ token_hash: tokenHash }).first();
  if (session) {
    await db('admin_sessions').where({ id: session.id }).del();
    await writeAudit('LOGOUT', 'Admin session ended.', 'INFO', req, session.user_id);
  }
}

async function resolveSession(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await db('admin_sessions').where({ token_hash: tokenHash }).first();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db('admin_sessions').where({ id: session.id }).del();
    return null;
  }
  const user = await db('admin_users').where({ id: session.user_id }).first();
  if (!user) return null;
  return {
    session,
    user: publicUser(user),
  };
}

async function getCsrfTokenForSession(sessionRow) {
  if (!sessionRow || !sessionRow.csrf_token_hash) {
    return null;
  }
  // Stateless re-issue: client must have stored token from login; if missing, rotate.
  const csrfToken = csrfService.generateCsrfToken();
  const csrfTokenHash = csrfService.hashCsrfToken(csrfToken);
  await db('admin_sessions').where({ id: sessionRow.id }).update({
    csrf_token_hash: csrfTokenHash,
  });
  return csrfToken;
}

async function validateSessionCsrf(sessionRow, providedToken) {
  if (!sessionRow || !sessionRow.csrf_token_hash) return false;
  return csrfService.validateCsrfToken(providedToken, sessionRow.csrf_token_hash);
}

async function revokeOtherSessions(userId, currentTokenHash) {
  const q = db('admin_sessions').where({ user_id: userId });
  if (currentTokenHash) {
    q.whereNot({ token_hash: currentTokenHash });
  }
  return q.del();
}

async function changePassword(userId, currentPassword, newPassword, req, currentSessionToken) {
  if (!newPassword || newPassword.length < 12) {
    const err = new Error('New password must be at least 12 characters.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const user = await db('admin_users').where({ id: userId }).first();
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  const ok = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  if (!ok) {
    const err = new Error('Current password is incorrect.');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db('admin_users').where({ id: userId }).update({
    password_hash: passwordHash,
    must_change_password: false,
    updated_at: db.fn.now(),
  });

  const currentHash = currentSessionToken ? hashToken(currentSessionToken) : null;
  const revoked = await revokeOtherSessions(userId, currentHash);
  await writeAudit(
    'PASSWORD_CHANGED',
    `Admin password updated. ${revoked} other session(s) revoked; current session kept.`,
    'CRITICAL',
    req,
    userId
  );
  return { success: true, sessionsRevoked: revoked };
}

async function totpSetup(userId) {
  const user = await db('admin_users').where({ id: userId }).first();
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  const secret = totpService.generateSecret();
  const otpauthUrl = totpService.buildOtpauthUrl(user.username, secret);
  const qrImageUrl = await totpService.qrDataUrl(otpauthUrl);
  return {
    secret,
    otpauthUrl,
    qrImageUrl,
    totpEnabled: Boolean(user.totp_enabled),
  };
}

async function totpEnable(userId, secret, code, req, currentSessionToken) {
  const user = await db('admin_users').where({ id: userId }).first();
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  const totpLock = await isTotpLocked(user.username);
  if (totpLock.locked) {
    const err = new Error(
      `Too many invalid authenticator attempts. Try again in ${totpLock.remainingMinutes} minute(s).`
    );
    err.status = 423;
    err.code = 'TOTP_LOCKED';
    throw err;
  }
  const counter = totpService.getVerifiedCounter(code, secret);
  if (!secret || counter === null) {
    await recordTotpFailedAttempt(user.username, req, userId);
    const err = new Error('Invalid authenticator code. Scan the QR code and enter the current 6-digit code.');
    err.status = 400;
    err.code = 'INVALID_TOTP';
    throw err;
  }
  const encrypted = cryptoService.encryptTotpSecret(secret);
  const backupCodes = await backupCodeService.replaceBackupCodes(userId);
  await db('admin_users').where({ id: userId }).update({
    totp_secret: encrypted,
    totp_enabled: true,
    totp_last_step: counter,
    updated_at: db.fn.now(),
  });
  await clearTotpLockout(user.username);
  const currentHash = currentSessionToken ? hashToken(currentSessionToken) : null;
  const revoked = await revokeOtherSessions(userId, currentHash);
  await writeAudit(
    'TOTP_ENABLED',
    `Google Authenticator 2FA enabled. ${revoked} other session(s) revoked.`,
    'CRITICAL',
    req,
    userId
  );
  return {
    success: true,
    totpEnabled: true,
    backupCodes,
    message: 'Save these backup codes now — they will not be shown again.',
  };
}

async function totpDisable(userId, password, code, req, currentSessionToken) {
  const user = await db('admin_users').where({ id: userId }).first();
  if (!user || !user.totp_enabled) {
    const err = new Error('Two-factor authentication is not enabled.');
    err.status = 400;
    err.code = 'TOTP_NOT_ENABLED';
    throw err;
  }
  const pwdOk = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!pwdOk) {
    const err = new Error('Current password is incorrect.');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }
  const totpLock = await isTotpLocked(user.username);
  if (totpLock.locked) {
    const err = new Error(
      `Too many invalid authenticator attempts. Try again in ${totpLock.remainingMinutes} minute(s).`
    );
    err.status = 423;
    err.code = 'TOTP_LOCKED';
    throw err;
  }
  const verify = await verifyAndConsumeStoredTotp(user, code);
  if (!verify.ok) {
    if (verify.reason === 'REPLAY') {
      const err = new Error('Authenticator code already used. Wait for the next code.');
      err.status = 401;
      err.code = 'TOTP_REPLAY';
      throw err;
    }
    await recordTotpFailedAttempt(user.username, req, userId);
    const err = new Error('Invalid authenticator code.');
    err.status = 401;
    err.code = 'INVALID_TOTP';
    throw err;
  }
  await db('admin_users').where({ id: userId }).update({
    totp_secret: null,
    totp_enabled: false,
    totp_last_step: null,
    updated_at: db.fn.now(),
  });
  await backupCodeService.clearBackupCodes(userId);
  await clearTotpLockout(user.username);
  const currentHash = currentSessionToken ? hashToken(currentSessionToken) : null;
  const revoked = await revokeOtherSessions(userId, currentHash);
  await writeAudit(
    'TOTP_DISABLED',
    `Google Authenticator 2FA disabled. ${revoked} other session(s) revoked.`,
    'CRITICAL',
    req,
    userId
  );
  return { success: true, totpEnabled: false, sessionsRevoked: revoked };
}

async function totpRotate(userId, password, code, req, currentSessionToken) {
  const user = await db('admin_users').where({ id: userId }).first();
  if (!user || !user.totp_enabled) {
    const err = new Error('Enable 2FA before rotating the secret.');
    err.status = 400;
    err.code = 'TOTP_NOT_ENABLED';
    throw err;
  }
  const pwdOk = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!pwdOk) {
    const err = new Error('Current password is incorrect.');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }
  const verify = await verifyAndConsumeStoredTotp(user, code);
  if (!verify.ok) {
    if (verify.reason === 'REPLAY') {
      const err = new Error('Authenticator code already used. Wait for the next code.');
      err.status = 401;
      err.code = 'TOTP_REPLAY';
      throw err;
    }
    await recordTotpFailedAttempt(user.username, req, userId);
    const err = new Error('Invalid authenticator code.');
    err.status = 401;
    err.code = 'INVALID_TOTP';
    throw err;
  }
  const secret = totpService.generateSecret();
  const otpauthUrl = totpService.buildOtpauthUrl(user.username, secret);
  const encrypted = cryptoService.encryptTotpSecret(secret);
  const backupCodes = await backupCodeService.replaceBackupCodes(userId);
  await db('admin_users').where({ id: userId }).update({
    totp_secret: encrypted,
    totp_last_step: null,
    updated_at: db.fn.now(),
  });
  const currentHash = currentSessionToken ? hashToken(currentSessionToken) : null;
  const revoked = await revokeOtherSessions(userId, currentHash);
  await writeAudit(
    'TOTP_ROTATED',
    `TOTP secret rotated; ${revoked} other session(s) revoked. Scan new QR in authenticator app.`,
    'CRITICAL',
    req,
    userId
  );
  return {
    success: true,
    secret,
    otpauthUrl,
    qrImageUrl: await totpService.qrDataUrl(otpauthUrl),
    backupCodes,
    sessionsRevoked: revoked,
  };
}

async function listAuditLogs(limit = 100) {
  return db('audit_logs').orderBy('id', 'desc').limit(Math.min(limit, 200));
}

module.exports = {
  login,
  verifyTotpLogin,
  logout,
  resolveSession,
  getCsrfTokenForSession,
  validateSessionCsrf,
  changePassword,
  totpSetup,
  totpEnable,
  totpDisable,
  totpRotate,
  writeAudit,
  listAuditLogs,
  clientIp,
  hashToken,
  revokeOtherSessions,
};
