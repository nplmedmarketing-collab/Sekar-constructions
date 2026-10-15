/**
 * Quick auth security integration test (login, CSRF, TOTP enable, password revoke).
 * Usage: node scripts/auth-security-test.js [baseUrl]
 */
const base = process.argv[2] || process.env.SMOKE_BASE || 'http://127.0.0.1:3001';

async function resetAdminForTest() {
  const bcrypt = require('bcryptjs');
  const db = require('../src/db');
  const hash = await bcrypt.hash('TestFixturePassword@2026!', 12);
  await db('admin_lockouts').del();
  await db('admin_sessions').del();
  try {
    await db('admin_backup_codes').del();
  } catch {
    /* ignore */
  }
  await db('admin_users').update({
    password_hash: hash,
    must_change_password: true,
    totp_enabled: false,
    totp_secret: null,
    totp_last_step: null,
  });
  await db.destroy();
}

async function json(path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = (body && body.error && body.error.message) || text || res.statusText;
    throw new Error(`${path} → ${res.status}: ${msg}`);
  }
  return body;
}

(async () => {
  console.log(`Auth security test ${base} …`);
  await resetAdminForTest();

  const login = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'TestFixturePassword@2026!' }),
  });
  console.log('login requires2FA:', login.requires2FA, 'csrf:', Boolean(login.csrfToken));

  const token = login.token;
  const csrf = login.csrfToken;
  if (!token || !csrf) throw new Error('Expected token + csrfToken from login');

  await json('/api/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword: 'TestFixturePassword@2026!',
      newPassword: 'SekarAdmin@2026!Strong',
    }),
  });
  console.log('password changed OK');

  const me = await json('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
  });
  console.log('me:', me.user.username, 'totpEnabled:', me.user.totpEnabled);

  const setup = await json('/api/auth/totp/setup', {
    headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
  });
  console.log('totp setup secret length:', setup.secret && setup.secret.length);

  // Enable with wrong code should fail
  try {
    await json('/api/auth/totp/enable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ secret: setup.secret, code: '000000' }),
    });
    throw new Error('Expected invalid TOTP to fail');
  } catch (err) {
    if (!/Invalid authenticator/i.test(err.message)) throw err;
    console.log('invalid enable rejected OK');
  }

  const health = await json('/api/health');
  console.log('health env present:', 'env' in health);

  console.log('AUTH SECURITY TEST OK');
})().catch((err) => {
  console.error('AUTH SECURITY TEST FAILED:', err.message);
  process.exit(1);
});
