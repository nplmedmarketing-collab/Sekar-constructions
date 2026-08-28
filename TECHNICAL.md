# Sekar Construction — Technical Document

Client handover reference for the corporate website and Super Admin CMS.  
Companion docs: [`api/README.md`](file:///d:/Developer/Sekar%20Construction/api/README.md) (API detail), [`api/DEPLOY.md`](file:///d:/Developer/Sekar%20Construction/api/DEPLOY.md) (production checklist).  
Do not invent or reuse hosting credentials from this repository.

---

## 1. Overview

Sekar Construction is a dual-surface web product:

| Surface | Purpose |
| :--- | :--- |
| **Public marketing site** | Static HTML/CSS/JS pages for corporate presence (home, about, infrastructure, projects, gallery, portfolio, careers, contact). CMS-backed sections hydrate from the API via `cms-public.js`. |
| **Super Admin CMS** | Browser admin (`admin-login.html` / `admin-dashboard.html`) for content edits, inquiries, and security (password, TOTP 2FA). Auth and writes go through the Node API only — no password hashes or TOTP secrets ship in frontend JS. |

Content is stored in a relational database and published live with **Save & Publish** actions on each CMS module.

---

## 2. Architecture

Static frontend (CDN / Nginx / any static host) + Node/Express REST API (`:3001`) + PostgreSQL in production. Local development may use SQLite (`file:./dev.sqlite`) without Docker, or optional Docker Postgres on host port 5433.

```mermaid
flowchart LR
  Browser["Browser"]
  Static["Static HTML/CSS/JS\n(config.js + cms-public.js\nor admin-auth.js)"]
  API["Node/Express API\n:3001"]
  DB[("PostgreSQL prod\nor SQLite / Docker PG local")]
 
  Browser --> Static
  Static -->|"REST + credentials"| API
  API --> DB
```

- Public pages call `GET /api/public/*` (and `POST /api/inquiries` from contact).
- Admin SPA prefers `Authorization: Bearer <token>`; API also sets an HttpOnly session cookie.
- `config.js` sets `window.SekarConfig.apiBaseUrl` (local $\rightarrow$ `http://127.0.0.1:3001`; production same-origin proxy $\rightarrow$ `window.location.origin`).

---

## 3. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Static HTML, `styles.css`, vanilla JS (`layout.js`, `script.js`, `cms-public.js`, `admin-auth.js`, `config.js`) |
| **Backend** | Node.js $\ge$ 18, Express 4 |
| **Database** | PostgreSQL 14+ (production); Knex migrations; SQLite via optional `better-sqlite3` (local only) |
| **Auth / Security Libs** | `bcrypt`, `otplib` (TOTP), `helmet`, `cors`, `express-rate-limit`, `cookie-parser`, `zod` (validation) |
| **Process / Ops** | PM2 (typical), Nginx/Caddy reverse proxy + HTTPS (see deploy guide) |
| **Local Optional DB** | Docker Compose Postgres 16 (`api/docker-compose.yml`, host 5433) |

---

## 4. Repository Layout

```text
/
├── index.html, about.html, infrastructure.html, ongoing-projects.html,
│   portfolio.html, gallery.html, careers.html, contact.html
├── admin-login.html, admin-dashboard.html
├── config.js              # apiBaseUrl
├── cms-public.js          # public CMS hydrate (no admin secrets)
├── admin-auth.js          # admin login, sessions UI, CMS writes, security
├── layout.js, script.js, styles.css
├── *.jpg / *.png …        # site imagery (URLs/paths referenced by CMS)
├── TECHNICAL.md           # this document
└── api/
    ├── README.md, DEPLOY.md, .env.example, docker-compose.yml
    ├── knexfile.js, package.json
    ├── migrations/        # schema evolution
    ├── seeds/             # default CMS + admin user
    ├── scripts/           # smoke / auth security tests
    └── src/
        ├── index.js, app.js, config.js, db.js
        ├── routes/        # auth, public, admin, inquiries
        ├── middleware/    # auth, validate, errors
        ├── services/      # content, auth, csrf, totp, backup codes, crypto
        └── data/defaults.js
```

---

## 5. Public Site

### Pages

| Page | Role |
| :--- | :--- |
| `index.html` | Home |
| `about.html` | Company / team (team photos from CMS) |
| `infrastructure.html` | Assets & inventory (CMS) |
| `ongoing-projects.html` | Active projects (CMS) |
| `portfolio.html` | Completed projects (CMS) |
| `gallery.html` | Project case-study gallery (CMS) |
| `careers.html` | Careers (static; no CMS hydrate scripts in current build) |
| `contact.html` | Contact / inquiry form $\rightarrow$ `POST /api/inquiries` |

### Shared Scripts

| Script | Used On | Role |
| :--- | :--- | :--- |
| `layout.js` | Public pages | Dynamically sets active link styles, handles mobile nav toggle and keyboard dropdown menu navigation on static HTML header/footer |
| `config.js` | Public + admin | `apiBaseUrl` |
| `cms-public.js` | Public marketing pages | Hydrate from `/api/public/*` only |
| `script.js` | Public pages | UI behavior; reads CMS via `window.SekarAdminSecurity`-compatible helpers from `cms-public.js` |
| `admin-auth.js` | Admin only | Auth + CMS writes — must not load on public pages |

*Note: Navigation markup is hardcoded across all 8 public HTML pages (`index.html`, `about.html`, `infrastructure.html`, `ongoing-projects.html`, `portfolio.html`, `gallery.html`, `careers.html`, `contact.html`). `layout.js` does not centralize header/footer rendering. Any structural menu changes require editing all 8 HTML files.*

### CMS Hydration (`cms-public.js`)

On load (when `apiBaseUrl` is set), the client fetches in parallel:

- `/api/public/infrastructure`
- `/api/public/ongoing-projects`
- `/api/public/completed-projects`
- `/api/public/gallery`
- `/api/public/fleet`
- `/api/public/financials`
- `/api/public/team-photos`

If the API is unavailable, hydrate fails softly (console warning); API mode does not resurrect hardcoded team URLs when hydrate fails.

**Script order**: `config.js` $\rightarrow$ `cms-public.js` $\rightarrow$ `script.js`.

*Never open pages via `file://` for CORS/auth testing — browsers send `Origin: null`, which the API rejects.*

---

## 6. Super Admin

| Item | Detail |
| :--- | :--- |
| **Login** | `admin-login.html` $\rightarrow$ `POST /api/auth/login` (username/password). If TOTP enabled $\rightarrow$ challenge $\rightarrow$ `POST /api/auth/verify-totp`. |
| **Dashboard** | `admin-dashboard.html` — module tabs below |
| **First Login** | Seed sets `must_change_password: true`; password change required before CMS writes (`requirePasswordChanged`). |
| **Idle Timeout** | Client 15 minutes inactivity logout (`sessionTimeoutMinutes`). Server session absolute lifetime: `SESSION_HOURS` (default 8). Idle timer does not extend server expiry. |

### Dashboard Modules

| Module | Panel | Publish Action |
| :--- | :--- | :--- |
| **Inquiries** | Bid/contact inbox | Status updates via PATCH (not a page publish) |
| **Fleet** | Asset counts | Save & Publish $\rightarrow$ `PUT /api/admin/fleet` |
| **Infrastructure** | Hero, highlights, inventory | Save & Publish $\rightarrow$ `PUT /api/admin/infrastructure` |
| **Ongoing Projects** | Hero, highlights, project rows | Save & Publish $\rightarrow$ `PUT /api/admin/ongoing-projects` |
| **Completed Projects** | Hero, highlights, project rows | Save & Publish $\rightarrow$ `PUT /api/admin/completed-projects` |
| **Project Gallery** | Case studies + image URL lists | Save & Publish $\rightarrow$ `PUT /api/admin/gallery` |
| **Financials** | Sections + turnover years | Save & Publish $\rightarrow$ `PUT /api/admin/financials` |
| **Team Gallery** | Team photo URLs/captions | Save via `PUT /api/admin/team-photos` |
| **Security** | Password change, TOTP setup/enable/disable/rotate, audit logs | Auth endpoints |

### Save & Publish Flow

1. Admin edits module data in the dashboard.
2. **Save & Publish** calls the matching `PUT /api/admin/…` with Bearer token (and CSRF header when cookie-auth applies).
3. API validates (Zod), replaces/updates DB rows, returns success.
4. Public site reflects changes on next hydrate / page load — no separate build step for CMS JSON.

---

## 7. API

| Item | Value |
| :--- | :--- |
| **Default Base** | `http://localhost:3001` (or production `apiBaseUrl` / same-origin `/api` proxy) |
| **Health** | `GET /api/health` $\rightarrow$ `{ ok: true, time }` (503 if DB down) |
| **Errors** | `{ "error": { "code": "…", "message": "…" } }` |

### Public vs Admin Routes

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/health` | No | Liveness + DB ping |
| **GET** | `/api/public/infrastructure` | No | Infra CMS payload |
| **GET** | `/api/public/ongoing-projects` | No | Ongoing CMS payload |
| **GET** | `/api/public/completed-projects` | No | Completed CMS payload |
| **GET** | `/api/public/gallery` | No | Gallery CMS payload |
| **GET** | `/api/public/fleet` | No | Fleet counts |
| **GET** | `/api/public/financials` | No | Financials (visible turnover) |
| **GET** | `/api/public/team-photos` | No | Team photos |
| **POST** | `/api/inquiries` | No (rate-limited) | Contact form |
| **POST** | `/api/auth/login` | No (rate-limited) | Login / 2FA challenge |
| **POST** | `/api/auth/verify-totp` | Challenge token | Complete 2FA login |
| **POST** | `/api/auth/logout` | Session | End session |
| **GET** | `/api/auth/csrf` | Session | Rotate CSRF token |
| **GET** | `/api/auth/me` | Session | Current user |
| **POST** | `/api/auth/change-password` | Session | Change password (min 12); revokes other sessions |
| **GET/POST** | `/api/auth/totp/*` | Session | Setup / enable / disable / rotate |
| **GET** | `/api/auth/audit-logs` | Session | Audit trail |
| **PUT** | `/api/admin/infrastructure` | Session + password changed | Publish infra |
| **PUT** | `/api/admin/ongoing-projects` | Session + password changed | Publish ongoing |
| **PUT** | `/api/admin/completed-projects` | Session + password changed | Publish completed |
| **PUT** | `/api/admin/gallery` | Session + password changed | Publish gallery |
| **PUT** | `/api/admin/fleet` | Session + password changed | Publish fleet |
| **PUT** | `/api/admin/financials` | Session + password changed | Publish financials |
| **PUT** | `/api/admin/team-photos` | Session + password changed | Publish team photos |
| **GET** | `/api/admin/inquiries` | Session + password changed | List inquiries |
| **GET** | `/api/admin/financials` | Session + password changed | Full financials incl. unpublished years |
| **PATCH** | `/api/admin/inquiries/:id` | Session + password changed | Update inquiry status |

---

## 8. Database

| Environment | Engine | Notes |
| :--- | :--- | :--- |
| **Production** | PostgreSQL only | `NODE_ENV=production` hard-fails if `DATABASE_URL` is not Postgres |
| **Local (verified, no Docker)** | SQLite | `DATABASE_URL=file:./dev.sqlite` |
| **Local (optional Docker)** | Postgres 16 | Host 5433 $\rightarrow$ container 5432; DB `sekar_cms`, user `sekar_local` (dev-only password in Compose / `.env.example`) |

### Migrations (Knex — add new dated files, never edit applied migrations):

1. `20260826120000_initial_schema.js` — core tables
2. `20260827100000_security_hardening.js` — CSRF hash on sessions; wider `totp_secret` storage
3. `20260827110000_totp_replay_backup_codes.js` — `totp_last_step`, `admin_backup_codes`

### Main Tables

| Table | Purpose |
| :--- | :--- |
| `admin_users` | Username, bcrypt hash, `must_change_password`, TOTP fields |
| `admin_sessions` | Token hash, expiry, IP/UA, `csrf_token_hash` |
| `admin_lockouts` | Failed login attempts / lockout window |
| `admin_backup_codes` | bcrypt-hashed single-use 2FA backups |
| `audit_logs` | Security / admin events |
| `page_content` | Hero blocks by `page_key` |
| `page_highlights` | Stat chips per page |
| `infra_inventory` | Equipment inventory rows |
| `projects` | Ongoing / completed (status) |
| `gallery_case_studies` / `gallery_images` | Case studies + image URLs |
| `fleet_assets` | Fleet name/count/icon |
| `financial_sections` / `financial_turnover_years` | Copy + yearly turnover |
| `team_photos` | Team image URLs/captions |
| `inquiries` | Contact / tender inquiries |

---

## 9. Authentication & Security

| Control | Behavior |
| :--- | :--- |
| **Passwords** | bcrypt cost 12; no plaintext bypasses |
| **Sessions** | DB-backed (`admin_sessions`); Bearer preferred + HttpOnly cookie; validated every request |
| **`must_change_password`** | Seed default true; admin routes blocked until change |
| **CSRF** | Cookie-authenticated mutations need allowlisted Origin/Referer and `X-CSRF-Token`. Bearer SPA clients skip CSRF |
| **TOTP 2FA** | `otplib`; secrets AES-256-GCM encrypted with key material from `SESSION_SECRET`; $\pm$1 step window; replay via `totp_last_step` |
| **Backup Codes** | 10 codes at enable/rotate; shown once; bcrypt-hashed; single-use; accepted at TOTP step |
| **Session Revoke** | Password change / 2FA enable-disable-rotate revoke other sessions (current kept) |
| **Rate Limits / Lockout** | Login rate-limited; password lockout defaults 5 / 15 min; separate TOTP failure limits |
| **CORS** | Explicit origin allowlist (`CORS_ORIGINS`); no `*` or `null`; credentials enabled |
| **Helmet** | Enabled on Express app |
| **`trust proxy`** | Enabled for reverse-proxy HTTPS / client IP |

*Layered session design: server absolute `SESSION_HOURS` (8h) + client idle 15 min — intentional.*

---

## 10. Configuration

### Frontend — `config.js`

```javascript
window.SekarConfig = {
  apiBaseUrl: /* local: http://127.0.0.1:3001 ; prod same-origin: window.location.origin */
};
```

Override before load for a separate API host, e.g. `https://api.sekarconstructions.com` (no trailing slash).

### API — Environment (`api/.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | Default `3001` |
| `DATABASE_URL` | SQLite file, local Docker Postgres, or production Postgres URL |
| `SESSION_SECRET` | $\ge$ 32 chars in prod; CSRF HMAC, TOTP encryption, login challenges |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `COOKIE_SAMESITE` | `lax` (same-site) or `none` (cross-site + Secure) |
| `SESSION_HOURS` | Absolute session lifetime (default 8) |
| `CORS_ORIGINS` | Comma-separated static site origins |
| `MAX_FAILED_ATTEMPTS` / `LOCKOUT_MINUTES` | Password lockout |
| `MAX_TOTP_FAILED_ATTEMPTS` / `TOTP_LOCKOUT_MINUTES` | TOTP lockout (optional) |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Seed credentials |
| `PG_SSL_CA` | Optional Postgres CA PEM (`rejectUnauthorized: true`) |
| `DATABASE_SSL` | Force SSL in non-prod if needed |

`.env`, `dev.sqlite`, and `_env` are gitignored.

---

## 11. Local Development

### Static Site

Serve with Live Server (or any HTTP server), e.g. `http://127.0.0.1:5500`.  
Ensure `CORS_ORIGINS` includes that origin. Do not use `file://`.

### API + DB (SQLite — verified without Docker)

```bash
cd api
cp .env.example .env          # DATABASE_URL=file:./dev.sqlite
npm install
npm run setup                 # migrate + seed
npm start                     # http://localhost:3001
npm run smoke                 # API must be running
```

### Optional Local Postgres (Docker)

```bash
cd api
# Set DATABASE_URL=postgres://sekar_local:sekar_local_dev_only@127.0.0.1:5433/sekar_cms
npm run db:up
npm run setup
npm start
```

Local Compose credentials are dev-only — never reuse in production.

### Admin Seed (Local)

- **Username**: `superadmin` (or `SEED_ADMIN_USERNAME`)
- **Password**: `SEED_ADMIN_PASSWORD`, or a console-printed temporary password if unset in development
- Production seed **hard-fails** without `SEED_ADMIN_PASSWORD`

---

## 12. Production Deployment

Full checklist: [`api/DEPLOY.md`](file:///d:/Developer/Sekar%20Construction/api/DEPLOY.md). Summary:

1. Provision **PostgreSQL** (own strong password; typically port **5432** on provider).
2. Deploy API: `npm ci --omit=dev`, set production `.env`, `npm run migrate`, seed **once** with `SEED_ADMIN_PASSWORD`, run under PM2 (or equivalent).
3. Terminate TLS at Nginx/Caddy/LB; proxy to `127.0.0.1:3001`; set `COOKIE_SECURE=true`.
4. Prefer same-domain `/api` reverse proxy (`SameSite=lax`) or set explicit `apiBaseUrl` + `COOKIE_SAMESITE=none` for cross-site.
5. Lock `CORS_ORIGINS` to real domains only.
6. Change seed password; enable **2FA**; smoke health + public GET + admin login from a second device.
7. **Do not** re-run seed on live after first load (destructive reload of CMS tables).

---

## 13. Content / CMS Data Model

| Module | Shape (high level) |
| :--- | :--- |
| **Infrastructure** | hero, up to 3 highlights, `inventory[]` (category, description, qty, unit) |
| **Ongoing** | hero, highlights, `projects[]` (region, name, patron, valueLakhs, progress) |
| **Completed** | hero, highlights, `projects[]` (region, name, valueLakhs) |
| **Gallery** | hero, highlights, `items[]` case studies (client, location, scope, image URL list) |
| **Fleet** | Array of `{ key, name, count, icon }` |
| **Financials** | Narrative `sections[]` + `turnoverYears[]` (year, amount, source, visible) — unpublished years admin-only |
| **Team** | `{ photo_id / id, url, caption }[]` |
| **Inquiries** | name, company, email, phone, subject, message, status, priority, value |

Defaults live in [`api/src/data/defaults.js`](file:///d:/Developer/Sekar%20Construction/api/src/data/defaults.js) and are applied by seeds. Gallery / named-project photography must be real client assets — not stock/AI stand-ins.

Images are stored as URL or path strings in the DB (no binary upload pipeline yet).

---

## 14. Known Phase-2 / Deferred

| Item | Status |
| :--- | :--- |
| **SMTP Email Dispatch** | Implemented (`emailService.js`), but untested — no live message has been sent to a mail server. Contact form submissions persist to DB regardless. |
| **Image upload to CDN / S3** | Deferred — CMS uses URL/path strings today |
| **Full admin UI rewrite to API-only storage** | API adapters in place; some panels may still touch localStorage until fully switched |
| **Hosting vendor accounts / managed DB passwords** | Not supplied by this repo — client IT provisions |

---

## 15. Credentials & Secrets

| Rule | Detail |
| :--- | :--- |
| **Never commit `.env`** | Or `dev.sqlite`, `_env`, or any live secrets |
| **Change default admin password** | Immediately after first seed login (`POST /api/auth/change-password` or Security UI) |
| **`SEED_ADMIN_PASSWORD`** | Required for production seed; use a unique strong value; bcrypt-hashed at rest |
| **`SESSION_SECRET`** | Unique $\ge$ 32 characters in production. **WARNING: Rotating `SESSION_SECRET` makes all stored `totp_secret` values undecryptable and permanently locks out every admin with 2FA enabled. They must disable 2FA before rotation and re-enrol after.** |
| **Local Docker DB password** | Dev-only (`sekar_local_dev_only`) — not for production |
| **No secrets in frontend** | Public pages: `cms-public.js` only; admin: no shipped password hash / TOTP / backup PIN |

*No hosting credentials, API keys, or production passwords are provided by this repository.*
