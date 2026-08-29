# Sekar Construction CMS API

Production-ready REST API for the Sekar Construction website CMS.  
**Production database: PostgreSQL only.**  
**Verified local path on this Windows workspace (no Docker / no `psql` on PATH): SQLite** via `DATABASE_URL=file:./dev.sqlite`.  
Optional local Postgres via Docker Compose (host port **5433**) when Docker Desktop is installed.

`better-sqlite3` is an **optionalDependency** so slim VPS installs without native build tools can omit it when using Postgres only.

## Requirements

- Node.js **18+** (20 LTS recommended)
- npm 9+
- **Local (this machine):** SQLite file DB — no Docker required
- **Optional local Postgres:** Docker Desktop (or Engine + Compose) — see below
- **Production:** PostgreSQL 14+ (managed or self-hosted)

## Quick start (verified: SQLite, no Docker)

This is the path that works when Docker is not installed. Run commands from `api/`.

```bash
cd api
cp .env.example .env
# .env.example defaults to SQLite — confirm:
# DATABASE_URL=file:./dev.sqlite

npm install
npm run setup          # migrate + seed
npm start              # http://localhost:3001
npm run smoke          # API must be running
```

Serve the static site with **Live Server** (or any HTTP origin), e.g. `http://127.0.0.1:5500`.  
**Never open pages via `file://` for authenticated / CORS testing** — browsers send `Origin: null`, which the API rejects. `CORS_ORIGINS` must never list `null` or `*`.

Production **hard-fails** if `DATABASE_URL` is not Postgres (`NODE_ENV=production`).

## Optional: local Postgres via Docker

Only when Docker Desktop (or Engine + Compose) is available. Compose file: **`api/docker-compose.yml`**.

**Local-dev credentials only** (never use in production):

| Field | Value |
|--------|--------|
| Host / port | `127.0.0.1:5433` (Compose maps host `5433` → container `5432`) |
| Database | `sekar_cms` |
| User | `sekar_local` |
| Password | `sekar_local_dev_only` |
| `DATABASE_URL` | `postgres://sekar_local:sekar_local_dev_only@127.0.0.1:5433/sekar_cms` |

```bash
cd api
# In .env, set the Postgres URL above (comment out the SQLite line)
npm install
npm run db:up          # docker compose up -d
npm run setup
npm start
npm run smoke
```

Stop the database container (keeps the named volume):

```bash
npm run db:down
```

**Port consistency:** local Docker host port is always **5433** (`"5433:5432"` in `docker-compose.yml`, matching `.env.example` comments and this README). Container-internal Postgres listens on **5432**. Production managed Postgres commonly uses **5432** on the provider host — that is a different environment, not the local Compose mapping.

## Admin seeding & credentials

Seeding requires **`SEED_ADMIN_PASSWORD`** (and optional `SEED_ADMIN_USERNAME`).
- **Production (`NODE_ENV=production`)**: Seeding **hard-fails** if `SEED_ADMIN_PASSWORD` is not set.
- **Local development**: If `SEED_ADMIN_PASSWORD` is unset, seed generates a unique temporary password and outputs it to the console.

```bash
# Recommended for any shared / staging / production seed:
SEED_ADMIN_USERNAME=superadmin
SEED_ADMIN_PASSWORD='GenerateAStrongUniquePassword!'
npm run seed
```

| Field | Value |
|--------|--------|
| Username | `superadmin` (or `SEED_ADMIN_USERNAME`) |
| Password | Value of `SEED_ADMIN_PASSWORD` (or auto-generated local temp password) |

**Mandatory for handover / go-live:**

1. Seed with a unique `SEED_ADMIN_PASSWORD` in environment variables.
2. Log in once and call `POST /api/auth/change-password` (or via admin UI).
3. First-time seed sets `must_change_password: true` — mandatory change on first login.
4. Never deploy without setting `SEED_ADMIN_PASSWORD`.

**Frontend note:** Public pages load `cms-public.js` (API hydrate only). Admin pages load `admin-auth.js` (no shipped password hash / TOTP / backup PIN). Production must set `apiBaseUrl` and seed with `SEED_ADMIN_PASSWORD`.

## Sessions (intentional layered design)

| Layer | Lifetime | Behavior |
|--------|----------|----------|
| **Server** (`SESSION_HOURS`, default **8**) | Absolute cookie / DB session expiry | Login creates a session row; after 8h the token is invalid even if the tab stays open. |
| **Client** (`sessionTimeoutMinutes: 15`) | Idle timeout | Admin UI logs out after 15 minutes of inactivity; activity resets the client timer (sliding UX). Does **not** extend the server expiry. |

This is intentional: short idle logout for unattended dashboards, longer absolute server max for active work sessions. To change either, set `SESSION_HOURS` in `.env` and/or the frontend inactivity minutes.

## Environment variables

See `.env.example`. Critical:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Local verified: `file:./dev.sqlite` · Optional Docker: `postgres://sekar_local:…@127.0.0.1:5433/sekar_cms` · Production: your managed Postgres URL (often `:5432`) |
| `SESSION_SECRET` | Long random string (≥32 chars). Signs CSRF tokens, encrypts TOTP secrets at rest, and signs 2FA login challenges. Required strong in production. |
| `CORS_ORIGINS` | Comma-separated allowlist of static site origins (no `null`, no `*`). Production should include `https://jobs.sekarconstructions.com` when careers is served there. |
| `JOBS_SITE_URL` | Public Sekar careers host (default `https://jobs.sekarconstructions.com`). Web origin only — not SMTP. |
| `COOKIE_SECURE` | `true` behind HTTPS in production |
| `SESSION_HOURS` | Absolute server session lifetime (default 8) |
| `SEED_ADMIN_PASSWORD` | Admin password at seed time (bcrypt-hashed) |
| `PG_SSL_CA` | Optional CA PEM path/inline for Postgres SSL with `rejectUnauthorized: true` |
| `PORT` | Default `3001` |
| `HRPOPS_API_KEY` | Optional HRPops API key (server-side only; job list and inline apply work without it) |
| `HRPOPS_COMPANY_ID` | Your HRPops company ID (Sekar: `215`) — required for careers integration |
| `HRPOPS_CANDIDATE_PORTAL_URL` | Optional **HRPops-hosted** portal link (`hrpops.com`) — do not set to `jobs.sekarconstructions.com` |
| `HRPOPS_APPLY_URL_TEMPLATE` | Optional per-job external Apply URL; leave unset for inline modal apply (default) |
| `HRPOPS_SMOKE_APPLY` | Set to `1` to include a live HRPops apply in `npm run smoke` (default off — avoids creating applicants) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Required for any outbound mail (inquiry alerts, careers thank-you, HR application alerts) |
| `SMTP_PORT` / `SMTP_SECURE` | Optional (default port `587`; set `SMTP_SECURE=true` for 465) |
| `NOTIFICATION_EMAIL` | Inbox for new contact/inquiry alerts and new careers applications (example: `careers@sekarconstructions.com`; use `ho@` if preferred) |

`.env`, `dev.sqlite`, and `_env` are gitignored. Never commit secrets.

When SMTP is unset, contact inquiries still persist and careers apply still returns success after HRPops accepts the application; thank-you / alert emails are skipped with a clear server warning.

**Live apply tests:** Any smoke test, probe, or script that POSTs to HRPops apply must use a clearly labeled **test email** such as `sekar.test+{unix}@mailinator.com` (or `test.sekar.careers+{unix}@mailinator.com`) and a name like `Sekar Test Applicant`. **Do not use real candidate emails.** Default `npm run smoke` only hits careers GETs; set `HRPOPS_SMOKE_APPLY=1` when you intentionally want a live apply.

### Postgres SSL (production)

Knex enables SSL in production (`rejectUnauthorized: false` by default for managed providers). If your host gives a CA certificate, set `PG_SSL_CA` to the PEM file path (or inline PEM) so the client uses `rejectUnauthorized: true` with that CA.

## Migrations

The initial schema lives in `migrations/20260826120000_initial_schema.js`.  
**Never edit a migration after it has run in production.** Add a new dated migration for schema changes instead.

## API surface

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/login` — `{ username, password }` → session cookie + JSON `{ token, csrfToken }`, or `{ requires2FA: true, challengeToken }` when TOTP enabled
- `POST /api/auth/verify-totp` — `{ challengeToken, code }` → full session after password step
- `POST /api/auth/logout`
- `GET /api/auth/csrf` — session required; returns fresh `{ csrfToken }` (rotates token)
- `GET /api/auth/me` — session required
- `POST /api/auth/change-password` — `{ currentPassword, newPassword }` (min 12 chars); **revokes all other sessions** for the user (**current session kept** — deliberate, so the admin changing the password is not signed out)
- `GET /api/auth/totp/setup` — provisional secret + QR URL (session required)
- `POST /api/auth/totp/enable` — `{ secret, code }` — verify code, encrypt secret, enable 2FA; returns **backup codes once** (hashed at rest, single-use)
- `POST /api/auth/totp/disable` — `{ password, code }` — revokes other sessions
- `POST /api/auth/totp/rotate` — `{ password, code }` — new secret + QR + fresh backup codes; revokes other sessions
- `GET /api/auth/audit-logs` — session required

Password hashing: **bcrypt** (cost 12). No plaintext password bypasses.

**TOTP / Google Authenticator:** server-side verification via `otplib`. Secrets stored **encrypted at rest** (AES-256-GCM keyed from `SESSION_SECRET`). Enrollment requires a valid 6-digit code before enabling. **Replay protection:** each time-step counter is stored (`totp_last_step`); immediate reuse of the same code is rejected. Window: **±1 step** only. TOTP failures are rate-limited separately from password lockout (`MAX_TOTP_FAILED_ATTEMPTS` / `TOTP_LOCKOUT_MINUTES`). **Backup codes:** 10 single-use codes generated at enable/rotate (bcrypt-hashed, shown once in the API response). Login accepts backup codes at the TOTP step. Enabling or disabling 2FA **revokes all other sessions** (current session kept).

**Auth model:** Admin SPA sends `Authorization: Bearer <token>` (preferred). The API also sets an HttpOnly session cookie for same-site / proxied deployments. Bearer clients skip CSRF; cookie clients require it on mutations.

**CSRF (cookie sessions):** Mutations authenticated via HttpOnly cookie require:
1. Allowlisted `Origin` / `Referer` (defense layer 1), and
2. `X-CSRF-Token` header matching the session token issued at login or from `GET /api/auth/csrf` (defense layer 2).

Bearer `Authorization` clients (the admin SPA default) skip CSRF — not subject to classic cross-site form POST. Prefer **same-site reverse proxy + `SameSite=Lax`** when possible; keep CSRF for cross-origin cookie deployments (`SameSite=None`).

Login is rate-limited; failed attempts trigger **account lockout** (defaults: 5 attempts / 15 minutes) with audit logs.

### Public CMS (no auth)

Shapes match the existing Super Admin JSON used by `admin-auth.js` / `script.js`:

- `GET /api/public/infrastructure`
- `GET /api/public/ongoing-projects`
- `GET /api/public/completed-projects`
- `GET /api/public/gallery`
- `GET /api/public/gallery-media` — Plant / Founder / Certificates / logo strips
- `GET /api/public/gallery-media/:section` — `plant-machinery` | `founder-clients` | `certificates` | `founder-logos`
- `GET /api/public/fleet`
- `GET /api/public/financials`
- `GET /api/public/team-photos`
- `GET /api/public/careers/jobs` — HRPops job listings (filtered by `HRPOPS_COMPANY_ID`)
- `GET /api/public/careers/jobs/:jobPostId` — single job detail from HRPops (includes `skillSets`)
- `GET /api/public/careers/countries` — geo dropdown (countries)
- `GET /api/public/careers/states/:countryId` — geo dropdown (states)
- `GET /api/public/careers/cities/:stateId` — geo dropdown via HRPops `GetCity` (no separate district API; India lists mix cities and localities — UI label is “City / Locality”)
- `POST /api/public/careers/apply` — multipart apply proxy to HRPops (`JobPostID`, `Email`, `Resume`, skills, languages, address fields; rate-limited). After HRPops success, non-blocking emails: candidate thank-you + optional HR alert to `NOTIFICATION_EMAIL` (never fails the apply if SMTP is unset or send errors). Resume/ProfilePic multipart filenames are sanitized to basename only before forwarding.

**Known HRPops resume URL bug:** Applications still save successfully, but opening a resume in the HRPops UI can 404 when their API embeds an absolute Windows path in the public URL, e.g. `https://api.hrpops.com/Resources/Resume/C:/Inetpub/vhosts/.../Resources/Resume/{id}{filename}.pdf` instead of `/Resources/Resume/{id}{filename}.pdf`. That path is their IIS `httpdocs` store, not something our apply proxy sends. Workaround: ask HRPops support to serve resumes by relative filename only (or fix DB/URL builder). Our side still strips directory segments from upload filenames to reduce risk.

### Public inquiries

- `POST /api/inquiries` — contact form submissions (rate-limited)

### Admin writes (session cookie or `Authorization: Bearer <token>`)

- `PUT /api/admin/infrastructure`
- `PUT /api/admin/ongoing-projects`
- `PUT /api/admin/completed-projects`
- `PUT /api/admin/gallery`
- `PUT /api/admin/gallery-media/:section` — same section slugs as public GET
- `PUT /api/admin/fleet`
- `PUT /api/admin/financials`
- `PUT /api/admin/team-photos`
- `GET /api/admin/inquiries`
- `PATCH /api/admin/inquiries/:id` — `{ status }`

Errors: `{ "error": { "code": "…", "message": "…" } }`

## Static site ↔ API

1. Edit site root `config.js`:

```js
window.SekarConfig = {
  apiBaseUrl: 'http://localhost:3001'  // or https://api.yourdomain.com
};
```

2. Include scripts correctly:
   - Public pages: `config.js` **before** `cms-public.js` (CMS hydrate from `/api/public/*` only).
   - Admin pages: `config.js` **before** `admin-auth.js` (login + dashboard CMS writes).

3. When `apiBaseUrl` is set, the site reads CMS data from the API and admin login uses the API (works from any device). Production must set `apiBaseUrl`. Auth secrets live only on the server (`SEED_ADMIN_PASSWORD` / bcrypt) — not in frontend JS.

4. Ensure `CORS_ORIGINS` includes every browser origin that calls the API (e.g. `https://www.sekarconstructions.com`, `https://jobs.sekarconstructions.com`).

**Careers / jobs subdomain:** Prefer reverse-proxying `/api` on `https://jobs.sekarconstructions.com` so `config.js` can use same-origin `apiBaseUrl`. See `DEPLOY.md` §4b. Frontend `jobsSiteUrl` defaults to that host; `HRPOPS_*` portal URLs stay on hrpops.com.

## npm scripts

| Script | Action |
|--------|--------|
| `npm run db:up` | Start local Docker Postgres (`docker compose up -d`) — requires Docker |
| `npm run db:down` | Stop Postgres container (volume kept) |
| `npm run db:logs` | Tail Postgres container logs |
| `npm run migrate` | Run migrations |
| `npm run seed` | Seed defaults |
| `npm run setup` | migrate + seed |
| `npm start` | Start server |
| `npm run start:prod` | Start with `NODE_ENV=production` |
| `npm run smoke` | Health + public GET smoke test (careers apply only if `HRPOPS_SMOKE_APPLY=1`, using test emails) |
| `npm run dev` | Start with `--watch` |

## Enabling 2FA (admin)

1. Log in with username + password (change default password first if `mustChangePassword` is set).
2. Open **Security settings** in the admin dashboard.
3. Scan the QR code (or enter the manual secret) in Google Authenticator / Authy.
4. Enter the live 6-digit code and click **Enable 2FA**.
5. Sign out and sign in again — you will be prompted for password, then authenticator code.

To rotate: **Rotate Secret** (requires password + current TOTP). To turn off: **Disable 2FA**.

## Production

See **[DEPLOY.md](./DEPLOY.md)** for PostgreSQL, PM2, reverse proxy / HTTPS, and client handover checklist.

## Deferred (phase-2)

- Image upload storage (CDN / S3) — currently URL/path strings
- Full admin dashboard UI rewrite to call PUT endpoints exclusively (API adapters are in place; some dashboard panels may still write localStorage until fully switched)
