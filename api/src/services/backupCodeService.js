const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

const BCRYPT_ROUNDS = 12;
const CODE_COUNT = 10;
const CODE_BYTES = 5;

function normalizeCode(code) {
  return String(code || '')
    .replace(/\s/g, '')
    .replace(/-/g, '')
    .toUpperCase();
}

function generatePlainCodes(count = CODE_COUNT) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(CODE_BYTES).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

async function replaceBackupCodes(userId) {
  await db('admin_backup_codes').where({ user_id: userId }).del();
  const plainCodes = generatePlainCodes();
  const rows = [];
  for (const code of plainCodes) {
    const codeHash = await bcrypt.hash(normalizeCode(code), BCRYPT_ROUNDS);
    rows.push({ user_id: userId, code_hash: codeHash });
  }
  await db('admin_backup_codes').insert(rows);
  return plainCodes;
}

async function consumeBackupCode(userId, code) {
  const normalized = normalizeCode(code);
  if (!normalized || normalized.length < 8) return false;

  const rows = await db('admin_backup_codes')
    .where({ user_id: userId })
    .whereNull('used_at')
    .orderBy('id', 'asc');

  for (const row of rows) {
    const ok = await bcrypt.compare(normalized, row.code_hash);
    if (!ok) continue;
    // Atomic consume: only one concurrent caller wins (0 rows = already used).
    const updated = await db('admin_backup_codes')
      .where({ id: row.id })
      .whereNull('used_at')
      .update({ used_at: db.fn.now() });
    if (updated === 1) return true;
  }
  return false;
}

async function clearBackupCodes(userId) {
  return db('admin_backup_codes').where({ user_id: userId }).del();
}

module.exports = {
  normalizeCode,
  replaceBackupCodes,
  consumeBackupCode,
  clearBackupCodes,
};
