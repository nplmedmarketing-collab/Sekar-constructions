# Admin + CMS API with GitHub Pages

## Honest limit

**GitHub Pages is static only.** It cannot run `/api/auth/login`, CMS writes, or MariaDB. The marketing site can live on `*.github.io`; the **Node API must run elsewhere** (VPS, Render, Railway) with a MariaDB/MySQL `DATABASE_URL`.

Admin already supports **cross-origin** login via **Bearer tokens** (`admin-auth.js` stores the session token and sends `Authorization: Bearer …`). Cookies are secondary; for github.io → remote API use `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` if you rely on cookies at all.

**Recommended for production admin:** serve admin (or the whole site) from the **same origin** as the API (e.g. API also serves static files, or Nginx proxies `/api`). Use github.io for marketing; run admin against a same-host deploy when possible.

## What already works in this repo

| Piece | Status |
|--------|--------|
| API routes (`/api/auth/*`, CMS, inquiries) | Exist under `api/` |
| Bearer + CSRF (bearer skips CSRF) | Supported |
| CORS allowlist + `credentials: true` | `api/src/app.js` |
| Prod cookie defaults | `COOKIE_SAMESITE=lax`, `COOKIE_SECURE` when `NODE_ENV=production` (set `COOKIE_SAMESITE=none` only for cross-origin admin cookies) |

## Steps: API on Render (free tier)

1. **Create a Render account** and connect the GitHub repo `nplmedmarketing-collab/Sekar-constructions`.

2. **Deploy the API**
   - **Option A — Blueprint:** New → Blueprint → use `api/render.yaml`.  
     If Render’s root is the **repo root**, set Docker context / Dockerfile to `api/` (edit the blueprint paths or create the Web Service manually with Root Directory `api`).
   - **Option B — Manual Web Service:** Root Directory = `api`, Runtime = Docker (uses `api/Dockerfile`), or Node with Build `npm install` and Start `npm run migrate && npm start`.

3. **Attach MariaDB / MySQL** (external host or managed MySQL if available) and set `DATABASE_URL` to a `mysql://` connection string. Render’s free Postgres addon is **not** compatible with this API anymore.

4. **Environment variables** (Dashboard → Environment):

   | Variable | Value |
   |----------|--------|
   | `NODE_ENV` | `production` |
   | `SESSION_SECRET` | Long random string (≥32 chars); Render can generate |
   | `DATABASE_URL` | MariaDB/MySQL URL (`mysql://…`) |
   | `CORS_ORIGINS` | `https://nplmedmarketing-collab.github.io` (comma-separate more origins if needed) |
   | `COOKIE_SECURE` | `true` |
   | `COOKIE_SAMESITE` | `none` |
   | `SEED_ADMIN_PASSWORD` | Strong password (seed once; then change via admin) |

5. **Migrate / seed**  
   Dockerfile already runs `npm run migrate` on boot. Seed once (Render Shell or one-off job):

   ```bash
   cd api   # if needed
   SEED_ADMIN_PASSWORD='…' npm run seed
   ```

6. **Point the static site at the API**  
   In repo root `config.site.js`, set:

   ```js
   var REMOTE_API_BASE = 'https://YOUR-SERVICE.onrender.com';  // no trailing slash — use YOUR real URL
   ```

   Commit and push so GitHub Pages picks it up. Do **not** invent a URL before the service exists.

7. **Verify**
   - `GET https://YOUR-SERVICE.onrender.com/api/health` → `{ "ok": true, … }`
   - Open `https://nplmedmarketing-collab.github.io/…/admin-login.html`, sign in with the seeded admin.
   - Free tier cold start: wait up to ~1 minute on first hit after idle.

## Alternative: Railway

1. New project → Deploy from GitHub → root `api` (or Dockerfile).
2. Add a MariaDB/MySQL database; set the same env vars as above (`CORS_ORIGINS`, `SESSION_SECRET`, `COOKIE_*`). Prefer `migrate` + content import over seed.
3. Set `REMOTE_API_BASE` in `config.site.js` to the Railway public HTTPS URL.

## Same-origin alternative (simpler cookies)

If cross-origin friction appears (browser extensions, third-party cookie blocking):

1. Host static files + API on one HTTPS host (VPS/Nginx, or Render static + reverse proxy).
2. Leave `REMOTE_API_BASE` empty and use `apiBaseUrl = window.location.origin`.
3. Prefer `COOKIE_SAMESITE=lax`.

GitHub Pages alone cannot do this; you need a host that runs Node.

## Checklist

- [ ] API deployed with MariaDB/MySQL `DATABASE_URL`
- [ ] `SESSION_SECRET` strong and unique
- [ ] `CORS_ORIGINS` includes `https://nplmedmarketing-collab.github.io`
- [ ] `REMOTE_API_BASE` in `config.site.js` matches the live API URL
- [ ] Admin seeded; default password changed after first login
- [ ] No `.env` secrets committed
