# Production deploy & client handover

This guide is for the client’s IT / hosting team. It does **not** invent hosting credentials — use your own MariaDB, VPS, or PaaS accounts.

**GitHub Pages + remote API (admin from github.io):** see [`DEPLOY-GITHUB-PAGES.md`](./DEPLOY-GITHUB-PAGES.md). Pages cannot host this Node API; use Render/Railway/VPS and set `REMOTE_API_BASE` in `config.site.js`.

## Architecture (recommended)

```
[ Browser ]
    │  static HTML/CSS/JS (CDN, Nginx, S3+CloudFront, etc.)
    │
    ├─ pages load config.js → apiBaseUrl = https://api.example.com
    │
    └─ REST calls ──► [ Node API on :3001 ] ──► [ MariaDB ]
                         HTTPS via Nginx/Caddy
```

- **Static site** and **API** may be on different hosts.
- Database: **MariaDB / MySQL only**. SQLite and PostgreSQL are not supported.

## Local / staging MariaDB

1. Provision MariaDB (hosting panel, managed DB, or `npm run db:up` for local Docker).
2. In `.env`, set:
   - `DATABASE_URL=mysql://USER:PASS%40WORD@HOST:3306/Sekarcons` (encode `@` in password as `%40`), **or**
   - `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
3. From `api/`: `npm install && npm run migrate`
4. To import existing CMS content from legacy SQLite: `npm run migrate:from-sqlite` (do **not** run `npm run seed` afterward).
5. `npm start` then `npm run smoke`

Shared-hosting MariaDB often **blocks remote TCP :3306** (firewall / “allow remote MySQL” off). If `connect ETIMEDOUT` from your laptop, run migrate + import **on the server** over SSH (or hosting Node console) where the DB listens on `127.0.0.1`, or enable remote MySQL for your IP in the panel.

## 1. Provision MariaDB (production)

Create a database and user in your host panel (example names):

- Database: `Sekarcons`
- User with full rights on that database

Connection string shape:

```
DATABASE_URL=mysql://USER:PASSWORD_ENCODED@DB_HOST:3306/Sekarcons
```

SSL: production enables MySQL SSL by default (`rejectUnauthorized: false` unless `MYSQL_SSL_CA` is set). Set `DATABASE_SSL=false` if the host does not support SSL.

## 2. Deploy the API

On the application server (Node 18+), ideally **same machine / private network** as MariaDB:

```bash
cd api
cp .env.example .env
# Edit .env — MariaDB URL or DB_*, SESSION_SECRET, CORS_ORIGINS, COOKIE_SECURE
npm ci --omit=dev
npm run migrate
# Import real content once (from uploaded dev.sqlite) — skip seed:
# npm run migrate:from-sqlite
NODE_ENV=production npm start
# or use PM2 (below)
```

### Process manager (PM2 example)

```bash
npm i -g pm2
cd api
pm2 start src/index.js --name sekar-api
pm2 save
pm2 startup
```

Set env in `.env` or PM2 ecosystem file — keep secrets out of git.

### Reverse proxy (HTTPS)

Terminate TLS at Nginx / Caddy / cloud load balancer and proxy to `127.0.0.1:3001`.

Ensure:

- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none` if static site and API are on **different** sites (requires Secure cookies + HTTPS)
- Or serve API under the same site (`https://www.example.com/api` → proxy) and use `SameSite=lax`
- Forward `X-Forwarded-For` / `X-Forwarded-Proto` headers (Express `trust proxy` is enabled)

**Example Nginx Server Block (`/etc/nginx/sites-available/sekarconstructions`):**

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 3. Configure the static site API origin

In `config.js`, `apiBaseUrl` defaults dynamically:
- **Option A (Recommended: Same-domain reverse-proxy)**: Proxy `https://www.sekarconstructions.com/api` to `http://127.0.0.1:3001`. Leave `config.js` as-is; it uses `window.location.origin` automatically, enabling `COOKIE_SAMESITE=lax`.
- **Option B (Separate API Subdomain)**: If hosted at `https://api.sekarconstructions.com`, set an explicit override in `config.js`:

```js
window.SekarConfig = {
  apiBaseUrl: 'https://api.sekarconstructions.com'  // no trailing slash
};
```

Deploy static files as usual:
- **Public marketing pages:** `config.js` then `cms-public.js` (API hydrate helpers only — no admin secrets).
- **Admin pages:** `config.js` then `admin-auth.js` (auth, audit, CMS writes).

With `apiBaseUrl` set, login is **API-only** (server bcrypt). Client-side password hashes / TOTP secrets are **not** shipped. Seed via `SEED_ADMIN_PASSWORD`.

**Content checklist:** Named-project gallery images (case studies) must be real client photography — do not invent or substitute stock/AI stand-ins for project-named works.

## 4. CORS

In API `.env`:

```
CORS_ORIGINS=https://www.sekarconstructions.com,https://sekarconstructions.com,https://jobs.sekarconstructions.com
```

Only list real production origins. Do **not** use `*` or literal `null`. The API refuses to start in production if either appears; `null` is always rejected.

Include `https://jobs.sekarconstructions.com` whenever the careers UI is served from that subdomain (required if the browser calls a **different** API origin; harmless if `/api` is same-origin proxied on jobs).

## 4b. Jobs subdomain (`jobs.sekarconstructions.com`)

Public careers (job listings + inline apply) is intended at **https://jobs.sekarconstructions.com**. This is a **web host**, not an SMTP mailbox. Outbound mail uses `SMTP_*` with From/`NOTIFICATION_EMAIL` typically `careers@sekarconstructions.com` (see `.env.example`).

Frontend: `config.js` sets `jobsSiteUrl` (default `https://jobs.sekarconstructions.com`). Nav/footer Careers links on the main site rewrite to that URL. On the jobs host, `apiBaseUrl` defaults to `window.location.origin`.

API: set `JOBS_SITE_URL=https://jobs.sekarconstructions.com` (optional documentation / absolute-link helper; default matches). Do **not** point `HRPOPS_CANDIDATE_PORTAL_URL` at jobs — that stays on `hrpops.com` if used; HRPops API remains `https://api.hrpops.com`.

### DNS (you configure — no credentials in this repo)

1. In your DNS provider for `sekarconstructions.com`, add an **A** or **CNAME** for `jobs` pointing at the same web server / CDN as the main site (or a dedicated vhost).
2. Issue TLS for `jobs.sekarconstructions.com` (Let’s Encrypt in Plesk, Certbot, etc.).

### Recommended hosting: same static files + `/api` proxy on jobs

Point the jobs subdomain document root at the same static site (or at least `careers.html`, `careers.js`, `config.js`, `layout.js`, `styles.css`, assets). Reverse-proxy `/api` to the Node process so the careers page stays same-origin.

**Nginx example (jobs vhost):**

```nginx
server {
    server_name jobs.sekarconstructions.com;
    # root /path/to/static/site;   # same files as www, or a careers-focused copy
    # ssl_certificate …;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = / {
        return 302 /careers.html;
    }
}
```

**Plesk (outline):** Domains → Add Subdomain `jobs` → document root = main site `httpdocs` (or a folder with careers assets) → SSL → Apache & nginx Settings → add an nginx additional directive for `location /api/` as above (proxy to `127.0.0.1:3001`).

With this setup, leave `config.js` defaults; use `COOKIE_SAMESITE=lax` if admin also shares that host (careers apply itself is public, no admin cookie required).

### Alternative: jobs static only, API on www

If `/api` is only on `https://www.sekarconstructions.com`:

1. Override before `config.js`:

```html
<script>
  window.SekarConfig = { apiBaseUrl: 'https://www.sekarconstructions.com' };
</script>
<script src="config.js"></script>
```

2. Ensure production `CORS_ORIGINS` includes `https://jobs.sekarconstructions.com`.
3. Prefer `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` only if you need cross-site **admin** cookies from jobs (usually unnecessary for public apply).

Optional: on www, 301 `careers.html` → `https://jobs.sekarconstructions.com/careers.html` once jobs is live.

## 5. Security checklist (must pass before go-live)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` / `DB_*` points to MariaDB/MySQL (`mysql://` or `mariadb://`) — SQLite/Postgres unsupported
- [ ] `SESSION_SECRET` is a unique random string ≥ 32 characters (used for CSRF, TOTP encryption, login challenges)
- [ ] Content imported via `migrate:from-sqlite` (or equivalent) — **do not** re-seed live CMS tables
- [ ] Admin password set / changed (`POST /api/auth/change-password`)
- [ ] `must_change_password` is false after first password change
- [ ] **2FA enabled** for production admin (`Security settings` → Enable 2FA) — recommended before go-live
- [ ] Admin SPA sends `X-CSRF-Token` on mutations (built into `admin-auth.js`); cookie-only clients must too
- [ ] `CORS_ORIGINS` locked to production domains only — **no `null`, no `*`** (include `https://jobs.sekarconstructions.com` when careers runs there)
- [ ] `COOKIE_SECURE=true` with HTTPS
- [ ] `config.js` has production `apiBaseUrl` (or uses window.location.origin); jobs host either proxies `/api` or sets `apiBaseUrl` to www/api
- [ ] Jobs subdomain DNS + TLS live; smoke `GET https://jobs.sekarconstructions.com/careers.html` and `GET …/api/public/careers/jobs`
- [ ] Public marketing pages load `cms-public.js` only (not `admin-auth.js`); no client-side password hashes in the repo
- [ ] Local-auth legacy fallback block removed from front-end JS (`admin-auth.js` does not ship secrets or local auth bypass)
- [ ] Gallery / team photos are real client photography for named projects (no invented stand-ins)
- [ ] Firewall: only 80/443 public; MariaDB not public (prefer localhost / private network)
- [ ] Automated backups for MariaDB
- [ ] `.env` / legacy `dev.sqlite` / `_env` never committed; file permissions restricted on server
- [ ] Smoke: `GET /api/health` returns `{ ok: true }`
- [ ] Smoke: `GET /api/public/infrastructure` returns inventory
- [ ] Admin login works from a second device/browser

## 6. Migrations & content import

- Prefer `npm run migrate` + `npm run migrate:from-sqlite` over `npm run seed`.
- After importing real content, do **not** run `npm run seed` on live (it deletes and reloads CMS tables).
- **Never edit** `migrations/20260826120000_initial_schema.js` (or any migration) after it has run in production — add a new migration instead.

## 7. Support notes

| Item | Value |
|------|--------|
| Health | `GET /api/health` |
| Docs | `api/README.md` |
| Database | MariaDB/MySQL via `DATABASE_URL` or `DB_*` |
| Local Docker Compose (optional) | `api/docker-compose.yml` host **3306** (`npm run db:up`) |
| Node | ≥ 18 |
| Sessions | Server `SESSION_HOURS` (default 8) + client 15-min idle timeout (intentional) |
| Default local user (dev only) | `superadmin` / `SEED_ADMIN_PASSWORD` — **not for production** |
| 2FA | Google Authenticator TOTP — enable in dashboard Security settings |
| CSRF | `X-CSRF-Token` on cookie-authenticated mutations; Bearer SPA clients exempt |
| Auth | Bearer (SPA default) + HttpOnly cookie; sessions validated against `admin_sessions` on every request |
| TOTP | Encrypted at rest, replay-protected, backup codes at enable/rotate |
| Password change | Revokes all other `admin_sessions` (current session kept) |
| 2FA toggle | Enable/disable revokes other sessions (current kept) |

No hosting vendor accounts, API keys, or passwords are supplied by this repository.
