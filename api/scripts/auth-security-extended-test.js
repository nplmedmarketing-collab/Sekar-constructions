/**
 * Extended auth security test — checklist items:
 * 1. Old session cookie/Bearer rejected after password change
 * 2. TOTP code accepted once, rejected on immediate reuse
 * 3. Contact form POST /api/inquiries works without CSRF token
 * 4. Admin PUT with valid cookie session but no CSRF token is refused
 *
 * Usage: node scripts/auth-security-extended-test.js [baseUrl]
 */
const { authenticator } = require('otplib');
const base = process.argv[2] || process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const ORIGIN = process.env.TEST_ORIGIN || 'http://127.0.0.1:5500';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { res, body, ok: res.ok };
}

async function json(path, options = {}) {
  const out = await request(path, options);
  if (!out.ok) {
    const msg = (out.body && out.body.error && out.body.error.message) || out.res.statusText;
    throw new Error(`${path} → ${out.res.status}: ${msg}`);
  }
  return out.body;
}

function authHeaders(token, csrf) {
  return {
    Authorization: `Bearer ${token}`,
    'X-CSRF-Token': csrf,
    'Content-Type': 'application/json',
  };
}

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  for (const line of raw) {
    const match = String(line).match(/sc_admin_session=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

async function waitForNextTotpStep() {
  const now = Math.floor(Date.now() / 1000);
  const waitMs = (30 - (now % 30) + 1) * 1000;
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function resetAdminForTest() {
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('TestFixturePassword@2026!', 12);
  await fetch(`${base}/api/health`).catch(() => {});
  const db = require('../src/db');
  await db('admin_lockouts').del();
  await db('admin_sessions').del();
  try {
    await db('admin_backup_codes').del();
  } catch {
    /* table may not exist on very old DBs */
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

(async () => {
  console.log(`Extended auth security test ${base} …`);
  await resetAdminForTest();

  const login1 = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ username: 'superadmin', password: 'TestFixturePassword@2026!' }),
  });
  let token = login1.token;
  let csrf = login1.csrfToken;

  await json('/api/auth/change-password', {
    method: 'POST',
    headers: authHeaders(token, csrf),
    body: JSON.stringify({
      currentPassword: 'TestFixturePassword@2026!',
      newPassword: 'SekarAdmin@2026!Strong',
    }),
  });
  console.log('password changed OK');

  // Test 3: public inquiry without CSRF (before 2FA complicates login)
  const inquiry = await json('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      name: 'Security Test',
      email: 'security-test@example.com',
      subject: 'CSRF exemption check',
      message: 'Automated auth-security-extended-test inquiry.',
    }),
  });
  if (!inquiry.success) throw new Error('Inquiry POST failed');
  console.log('TEST 3 OK: POST /api/inquiries without CSRF');

  // Test 4: cookie-authenticated admin PUT without CSRF refused (before 2FA)
  const cookieLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ username: 'superadmin', password: 'SekarAdmin@2026!Strong' }),
  });
  if (!cookieLogin.ok || !cookieLogin.body.token) throw new Error('Cookie login failed for CSRF test');
  const sessionCookie = parseSetCookie(cookieLogin.res);
  if (!sessionCookie) throw new Error('Expected session cookie from login');

  const adminPut = await request('/api/admin/fleet', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      Cookie: `sc_admin_session=${sessionCookie}`,
    },
    body: JSON.stringify([]),
  });
  if (adminPut.res.status !== 403) {
    throw new Error(`Expected 403 without CSRF on cookie PUT, got ${adminPut.res.status}`);
  }
  const csrfCode = adminPut.body && adminPut.body.error && adminPut.body.error.code;
  if (!/CSRF/i.test(String(csrfCode || ''))) {
    throw new Error(`Expected CSRF error code, got ${csrfCode}`);
  }
  console.log('TEST 4 OK: cookie admin PUT without CSRF refused');

  // Test 1: old sessions rejected after password change (Bearer + cookie)
  const sessionA = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ username: 'superadmin', password: 'SekarAdmin@2026!Strong' }),
  });
  const cookieRespB = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ username: 'superadmin', password: 'SekarAdmin@2026!Strong' }),
  });
  const sessionBToken = cookieRespB.body.token;
  const sessionBCookie = parseSetCookie(cookieRespB.res);
  const sessionBCsrf = cookieRespB.body.csrfToken;

  await json('/api/auth/change-password', {
    method: 'POST',
    headers: authHeaders(sessionA.token, sessionA.csrfToken),
    body: JSON.stringify({
      currentPassword: 'SekarAdmin@2026!Strong',
      newPassword: 'SekarAdmin@2026!Strong2',
    }),
  });

  try {
    await json('/api/auth/me', { headers: authHeaders(sessionBToken, sessionBCsrf) });
    throw new Error('Expected old Bearer session rejected after password change');
  } catch (err) {
    if (!/401|Authentication/i.test(err.message)) throw err;
    console.log('TEST 1a OK: old Bearer rejected after password change');
  }

  const staleCookieMe = await request('/api/auth/me', {
    headers: {
      Origin: ORIGIN,
      Cookie: `sc_admin_session=${sessionBCookie}`,
      'X-CSRF-Token': sessionBCsrf,
    },
  });
  if (staleCookieMe.res.status !== 401) {
    throw new Error(`Expected stale cookie session rejected, got ${staleCookieMe.res.status}`);
  }
  console.log('TEST 1b OK: old cookie session rejected after password change');

  await json('/api/auth/me', { headers: authHeaders(sessionA.token, sessionA.csrfToken) });
  console.log('current session kept after password change OK');

  token = sessionA.token;
  csrf = sessionA.csrfToken;

  const setup = await json('/api/auth/totp/setup', { headers: authHeaders(token, csrf) });
  const code = authenticator.generate(setup.secret);
  await json('/api/auth/totp/enable', {
    method: 'POST',
    headers: authHeaders(token, csrf),
    body: JSON.stringify({ secret: setup.secret, code }),
  });
  console.log('TOTP enabled OK');
  await waitForNextTotpStep();

  const login2 = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'SekarAdmin@2026!Strong2' }),
  });
  if (!login2.requires2FA) throw new Error('Expected requires2FA after enable');
  const code2 = authenticator.generate(setup.secret);
  const login3 = await json('/api/auth/verify-totp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken: login2.challengeToken, code: code2 }),
  });
  console.log('2FA login OK');

  // Test 2: TOTP replay — same code rejected immediately
  const replayLogin = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'SekarAdmin@2026!Strong2' }),
  });
  try {
    await json('/api/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken: replayLogin.challengeToken, code: code2 }),
    });
    throw new Error('Expected TOTP replay to be rejected');
  } catch (err) {
    if (!/401|TOTP|authenticator|already used/i.test(err.message)) throw err;
    console.log('TEST 2 OK: TOTP replay rejected');
  }

  await waitForNextTotpStep();

  const login4 = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'SekarAdmin@2026!Strong2' }),
  });
  const code4 = authenticator.generate(setup.secret);
  const session2 = await json('/api/auth/verify-totp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken: login4.challengeToken, code: code4 }),
  });

  const revoke = await json('/api/auth/change-password', {
    method: 'POST',
    headers: authHeaders(login3.token, login3.csrfToken),
    body: JSON.stringify({
      currentPassword: 'SekarAdmin@2026!Strong2',
      newPassword: 'SekarAdmin@2026!Strong3',
    }),
  });
  console.log('sessions revoked:', revoke.sessionsRevoked);

  try {
    await json('/api/auth/me', { headers: authHeaders(session2.token, session2.csrfToken) });
    throw new Error('Expected second session revoked');
  } catch (err) {
    if (!/401|Authentication/i.test(err.message)) throw err;
    console.log('other session invalidated after second password change OK');
  }

  await json('/api/auth/me', { headers: authHeaders(login3.token, login3.csrfToken) });
  console.log('current session kept after second password change OK');

  console.log('EXTENDED AUTH SECURITY TEST OK');
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
