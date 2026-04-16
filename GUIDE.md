# MOSPI Backend — Complete Walkthrough

This document explains **every file** in the project, **why it exists**, and **how a request flows** through the system. Read it top-to-bottom and you'll understand the whole codebase.

---

## Table of contents

1. [The big picture](#1-the-big-picture)
2. [The folder structure — why each folder exists](#2-the-folder-structure--why-each-folder-exists)
3. [The layers — routes, controllers, db](#3-the-layers--routes-controllers-db)
4. [Request lifecycle — what happens when a request arrives](#4-request-lifecycle--what-happens-when-a-request-arrives)
5. [Environment variables explained](#5-environment-variables-explained)
6. [The database — schema and relationships](#6-the-database--schema-and-relationships)
7. [Authentication — access + refresh tokens](#7-authentication--access--refresh-tokens)
8. [File uploads — how multer works here](#8-file-uploads--how-multer-works-here)
9. [Middlewares — what each one does and why the order matters](#9-middlewares--what-each-one-does-and-why-the-order-matters)
10. [Error handling](#10-error-handling)
11. [Health checks](#11-health-checks)
12. [Rate limiting — the meter](#12-rate-limiting--the-meter)
13. [Graceful shutdown](#13-graceful-shutdown)
14. [Patterns you'll see repeated — why](#14-patterns-youll-see-repeated--why)
15. [How to add a new resource (template)](#15-how-to-add-a-new-resource-template)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. The big picture

**What this backend does:**
It's a REST API that:
- Stores data in PostgreSQL.
- Lets users register, log in, refresh their session, and log out.
- Manages a 4-level hierarchy: **Sector → Category → Indicator → KPI**.
- Manages **Banners** (homepage banners / sliders).
- Accepts image uploads for icons.
- Exposes `/api/health` for monitoring.

**The stack:**

| Tool | Role |
|---|---|
| Node.js 20+ | JavaScript runtime |
| Express 4 | HTTP framework |
| PostgreSQL | Relational database |
| `pg` | Postgres client for Node |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT (auth tokens) |
| `helmet` | Secure HTTP headers |
| `cors` | Cross-origin access control |
| `express-rate-limit` | Request throttling |
| `morgan` | HTTP request logging |
| `multer` | Multipart file uploads |
| `compression` | Gzip responses |
| `uuid` | Unique request IDs |
| `dotenv` | `.env` → `process.env` |

**The conceptual hierarchy:**
```
Sector ─┐
        └── Category ─┐
                      └── Indicator ─┐
                                     └── KPI
```
Everything cascades on delete — if you delete a Sector, all its Categories, Indicators and KPIs go with it.

---

## 2. The folder structure — why each folder exists

```
src/
├── config/         → things that configure the app: DB pool, schema
├── controllers/    → the functions that handle requests (the "what to do")
├── middlewares/    → functions that run between request and controller
├── routes/         → URL → controller wiring
├── utils/          → small reusable helpers (asyncHandler)
├── app.js          → builds the Express app (middleware + routes)
└── server.js       → starts the HTTP server, handles shutdown
```

### `config/`
- **`db.js`** creates a connection pool to Postgres and exports a `query()` helper. The pool is reused for every request — opening a new DB connection per request would be slow.
- **`schema.sql`** is the SQL you run once to create all tables. It's the blueprint of your database.

### `controllers/`
Each file handles one resource: `auth`, `banner`, `sector`, `category`, `indicator`, `kpi`, `health`. A controller is a **function that reads `req`, does work, and writes `res`**. It doesn't care about URLs — the router decides that.

### `middlewares/`
A middleware is a function `(req, res, next) => { ... }` that runs **before** the controller. Examples:
- `auth.js` (`protect`) — checks for a valid JWT.
- `upload.js` — parses uploaded files.
- `rateLimiter.js` — rejects too-many-requests.
- `requestId.js` — attaches an ID.
- `logger.js` — prints the request to the terminal.
- `errorHandler.js` — catches errors and sends a clean JSON response.

### `routes/`
Each file maps URLs like `POST /login` to a controller function. There's an `index.js` that combines them all under `/api`.

### `utils/`
- **`asyncHandler.js`** — a helper so we don't have to write `try/catch` in every controller. (Explained in §14.)

### `app.js` vs `server.js`
- **`app.js`** — defines the Express app (pure config, no listening). This separation makes testing easy (you can mount `app` in tests without binding a port).
- **`server.js`** — actually starts the HTTP server on port 5000 and handles shutdown signals.

---

## 3. The layers — routes, controllers, db

Every request follows the same path:

```
Request  ──▶  Middlewares  ──▶  Router  ──▶  Controller  ──▶  DB (pg query)
                                                    │
Response ◀───────────── JSON ◀──────────────────────┘
```

### Why split them?

- **Router** knows URLs.
- **Controller** knows HTTP (reads `req.body`, writes `res.json`).
- **DB module** knows SQL.

If you later swap Postgres for MongoDB, only `db.js` and the SQL strings in controllers change — routes stay the same.

### A concrete example — creating a banner

1. Frontend sends `POST /api/banners` with a JSON body.
2. `app.js` applies: request ID → logger → helmet → CORS → rate limiter → JSON parser → `/api` routes.
3. `routes/index.js` sees `/banners/*` and delegates to `routes/banner.routes.js`.
4. `routes/banner.routes.js` sees `POST /` and calls `createBanner` from the controller.
5. `controllers/banner.controller.js#createBanner` reads `req.body`, validates, runs `INSERT INTO banners ...` via `db.query()`.
6. It responds with `res.status(201).json({ success: true, data: <the new row> })`.
7. On the way out, `compression` gzips the response.

---

## 4. Request lifecycle — what happens when a request arrives

Here is the **exact order** of things, as wired in [src/app.js](src/app.js):

```
1.  requestId         → attach req.id, set X-Request-Id header
2.  httpLogger        → print the request line to the terminal
3.  helmet            → secure HTTP headers (XSS, clickjacking, etc.)
4.  cors              → allow/deny based on Origin
5.  compression       → will gzip the response body later
6.  express.json      → parse application/json into req.body
7.  express.urlencoded→ parse url-encoded forms into req.body
8.  /uploads static   → serve uploaded icons (only for /uploads/*)
9.  globalLimiter     → reject after too many requests (on /api/*)
10. routes            → route to the matching controller
11. notFound          → no route matched → 404
12. errorHandler      → catch any thrown error, send JSON
```

**Why this order?**
- Logging + ID come first so every later middleware is traceable.
- Security headers before CORS because helmet sets safe defaults regardless of origin.
- Body parsers before routes because routes read `req.body`.
- Rate limiter before routes because rejecting traffic early saves work.
- `notFound` and `errorHandler` must be last — they catch what earlier middleware didn't.

---

## 5. Environment variables explained

Stored in `.env` (never committed) — loaded by `dotenv.config()` in `server.js`.

| Variable | Meaning |
|---|---|
| `PORT` | HTTP port. Default 5000. |
| `NODE_ENV` | `development` or `production`. |
| `PG_HOST/PORT/DATABASE/USER/PASSWORD` | Postgres connection. |
| `JWT_ACCESS_SECRET` | Secret used to sign short-lived access tokens. |
| `JWT_REFRESH_SECRET` | **Different** secret for refresh tokens. Never reuse the same. |
| `JWT_ACCESS_EXPIRES_IN` | e.g. `15m` — access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `7d` — refresh token lifetime. |
| `CORS_ORIGIN` | Comma-separated frontend origins allowed to call the API. |
| `RATE_LIMIT_WINDOW_MS` | Window for the global limiter (ms). |
| `RATE_LIMIT_MAX` | Allowed requests per window (global). |
| `AUTH_RATE_LIMIT_MAX` | Stricter limit for `/auth/*`. |

**Why split access and refresh secrets?**
If your access secret leaks, attackers can only forge 15-minute tokens. They can't mint a 7-day refresh token because that needs the refresh secret. Two locks, not one.

---

## 6. The database — schema and relationships

See [src/config/schema.sql](src/config/schema.sql) for the full DDL. Here's the model.

### Tables

- **users** — `id, name, email (unique), password (bcrypt hash), created_at`
- **refresh_tokens** — `id, user_id → users, token_hash (sha256), expires_at, revoked_at, created_at`
- **banners** — marketing/homepage sliders (no FKs)
- **sectors** — top of hierarchy, has a unique `sector_slug`
- **categories** — `sector_id → sectors` (cascade), unique `category_slug`
- **indicators** — `sector_id, category_id` (both cascade)
- **kpis** — `sector_id, category_id, indicator_id` (all cascade), unique `kpi_slug`

### Why cascade?

If an admin deletes a Sector, every Category/Indicator/KPI below it would be orphaned. `ON DELETE CASCADE` tells Postgres to delete them automatically — data stays consistent without extra application code.

### Why camelCase fields in API but snake_case in DB?

- Postgres convention → `snake_case`.
- JS / JSON convention → `camelCase`.
- So every `SELECT` does: `sector_id AS "sectorId"` — translates at the edge.

### Why `display_order` instead of `order`?

`order` is a **reserved SQL keyword** (`ORDER BY`). Using it as a column name forces awkward double-quoting. We just named the column `display_order` and alias it back to `order` in responses.

### Why store refresh tokens as SHA-256 hashes?

If the DB is ever leaked, hashed tokens are useless — the attacker can't present a valid refresh token without the original (plaintext) version. It's the same reason we hash passwords.

---

## 7. Authentication — access + refresh tokens

This is the most conceptually complex part. Here's the mental model.

### Why two tokens?

A single long-lived token would be convenient but risky:
- If stolen, it works for days.
- You can't revoke it without checking the DB on every request (expensive).

Two tokens solve this:

| Token | Lifetime | Where stored | Purpose |
|---|---|---|---|
| **Access** | 15 minutes | In memory on the frontend | Proves "I'm user X" on every API call |
| **Refresh** | 7 days | Secure storage (httpOnly cookie ideal) | Swap for a new access token |

Short-lived access tokens limit blast radius. Long-lived refresh tokens are stored server-side (as hashes) so they can be revoked.

### The full flow

```
┌─────────────┐                                  ┌────────────┐
│  Frontend   │                                  │  Backend   │
└─────┬───────┘                                  └─────┬──────┘
      │  1. POST /auth/login  { email, password }     │
      │──────────────────────────────────────────────▶│
      │       { accessToken, refreshToken, user }    │
      │◀──────────────────────────────────────────────│
      │                                                │
      │  2. GET /auth/me  Authorization: Bearer <at>  │
      │──────────────────────────────────────────────▶│
      │                  200 { user }                 │
      │◀──────────────────────────────────────────────│
      │                                                │
      │     ... 16 minutes later ...                   │
      │  3. GET /auth/me  (with old access token)     │
      │──────────────────────────────────────────────▶│
      │          401 "Access token expired"           │
      │◀──────────────────────────────────────────────│
      │                                                │
      │  4. POST /auth/refresh  { refreshToken }      │
      │──────────────────────────────────────────────▶│
      │    DB: revoke old refresh + insert new        │
      │  { accessToken: NEW, refreshToken: NEW }      │
      │◀──────────────────────────────────────────────│
      │                                                │
      │  5. Retry /auth/me with the new access token  │
      │──────────────────────────────────────────────▶│
      │                  200 { user }                 │
      │◀──────────────────────────────────────────────│
      │                                                │
      │  6. POST /auth/logout  { refreshToken }       │
      │──────────────────────────────────────────────▶│
      │    DB: mark refresh token revoked             │
      │                  200 ok                       │
      │◀──────────────────────────────────────────────│
```

### Rotation

Every `/refresh` **invalidates the old refresh token and issues a new one**. This is called rotation.

**Why?** Suppose an attacker steals a user's refresh token. As soon as either the user *or* the attacker uses it once, it's rotated. The next party to use the old token sees `"Refresh token not recognised"`. At that point the backend **revokes every session for that user** (defence-in-depth) — someone is doing something suspicious.

### How `protect` works

`middlewares/auth.js#protect` is the guard for any route that needs authentication:

```
1. Read "Authorization" header.
2. Extract the token after "Bearer ".
3. jwt.verify(token, JWT_ACCESS_SECRET).
4. If valid: attach req.user = { id: payload.sub } and call next().
5. If expired: respond 401 "Access token expired".
6. If invalid: respond 401 "Invalid token".
```

Then any protected controller can read `req.user.id` to know who is calling.

### Files involved

- [src/controllers/auth.controller.js](src/controllers/auth.controller.js) — register, login, refresh, logout, me
- [src/middlewares/auth.js](src/middlewares/auth.js) — the `protect` middleware
- [src/routes/auth.routes.js](src/routes/auth.routes.js) — URLs

---

## 8. File uploads — how multer works here

See [src/middlewares/upload.js](src/middlewares/upload.js).

### What multer does

Multer parses `multipart/form-data` (the format browsers use when a form has a file input) and splits it into:
- `req.body` — text fields
- `req.file` — the single uploaded file (for `upload.single('fieldName')`)

### The storage strategy

We use `diskStorage` — files are saved to the `uploads/` folder on disk with a unique name. The filename pattern is:

```
<timestamp>-<randomNumber><originalExtension>
e.g. 1728123456789-731228394.png
```

Why unique names? Two users uploading `icon.png` shouldn't overwrite each other.

### The restrictions

- **Max size**: 5 MB.
- **Allowed mimetypes**: `image/jpeg|png|gif|webp|svg+xml`. A `fileFilter` function rejects anything else with an error — prevents a user from uploading a `.exe` disguised as an icon.

### How the controller uses it

```js
export const createSector = async (req, res, next) => {
  // req.body.name, req.body.cardColor, etc.   — regular fields
  // req.file                                  — the uploaded file, or undefined
  const icon = fileUrl(req);   // → "/uploads/1728...-731.png" or null
  await query('INSERT INTO sectors (...) VALUES (..., $8, ...)', [..., icon, ...]);
};
```

`fileUrl(req)` just returns the public URL path so the frontend can render the image later.

### Serving the uploaded files

[src/app.js](src/app.js) has:
```js
app.use('/uploads', express.static(path.resolve('uploads')));
```
This tells Express: "any request for `/uploads/<anything>` — look for that file in the `uploads/` folder and stream it back."

So in the frontend:
```jsx
<img src={`http://localhost:5000${kpi.KpiIcon}`} />
```

---

## 9. Middlewares — what each one does and why the order matters

| # | Middleware | File | Purpose |
|---|---|---|---|
| 1 | `requestId` | `middlewares/requestId.js` | Adds `req.id` and `X-Request-Id` header |
| 2 | `httpLogger` | `middlewares/logger.js` | Prints request line via morgan |
| 3 | `helmet` | built-in via `helmet()` | Adds secure HTTP response headers |
| 4 | `cors` | built-in via `cors()` | Enforces Origin allow-list |
| 5 | `compression` | built-in | Gzips responses (saves bandwidth) |
| 6 | `express.json` | built-in | Parses JSON bodies |
| 7 | `express.urlencoded` | built-in | Parses urlencoded bodies |
| 8 | `express.static` | built-in | Serves `/uploads/*` |
| 9 | `globalLimiter` | `middlewares/rateLimiter.js` | Throttles `/api/*` |
| 10 | routes | `routes/*` | Matches URL → controller |
| 11 | `notFound` | `middlewares/errorHandler.js` | 404 fallback |
| 12 | `errorHandler` | `middlewares/errorHandler.js` | Last-resort error catcher |

There are **two more** middleware that are attached only on specific routes:

| Route-level middleware | Where | Purpose |
|---|---|---|
| `authLimiter` | `routes/auth.routes.js` | Strict limit on login/register/refresh |
| `protect` | any route that needs login | JWT guard |
| `upload.single(<field>)` | sector/category/indicator/kpi routes | Parses uploaded image |

### The golden rule of middleware order

**A middleware can only affect stages that come after it.**
If you put `express.json` after the route, `req.body` will be empty in the controller. If you put `errorHandler` first, it will never catch anything.

---

## 10. Error handling

See [src/middlewares/errorHandler.js](src/middlewares/errorHandler.js).

### How errors reach the handler

Two ways:
1. **Synchronous** throw: `throw new Error('boom')` — Express catches it automatically.
2. **Async** throw: `await query(...)` that rejects — Express **does not** catch promise rejections. That's why we wrap async controllers in `asyncHandler`:

```js
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

`.catch(next)` hands the error to the next middleware — which is `errorHandler`.

### What the handler does

```js
export const errorHandler = (err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
  });
};
```

- Logs the error to the terminal.
- Sends a JSON response with the right status code.
- **Hides internal messages** for 500s so stack traces don't leak to clients.

### The 404 handler

If no route matched, `notFound` creates a 404 response with the URL that was tried. It's separate from the error handler so you can easily change the 404 behaviour later (e.g. serve a custom HTML page).

---

## 11. Health checks

Two endpoints, two purposes:

### `GET /api/health` — liveness
```
"Is the process running?"
```
Fast, no external calls. Used by Docker/Kubernetes to decide whether to restart the container. If this ever returns non-2xx, the orchestrator kills and restarts the container.

### `GET /api/health/ready` — readiness
```
"Can I actually serve traffic right now?"
```
Pings Postgres with `SELECT 1`. Also returns:
- `uptime` — seconds since the process started
- `memory.rssMB / heapUsedMB` — for dashboards
- `nodeVersion` — for debugging upgrades
- `database.ok` + `database.latencyMs` — is the DB healthy and how fast?

Returns **200** when healthy, **503** when the DB is down. Load balancers use this to stop routing traffic to unhealthy instances.

---

## 12. Rate limiting — the meter

See [src/middlewares/rateLimiter.js](src/middlewares/rateLimiter.js).

### Two limiters

| Limiter | Applies to | Default window / max |
|---|---|---|
| `globalLimiter` | every `/api/*` request | 100 per 15 min per IP |
| `authLimiter` | `/auth/register`, `/auth/login`, `/auth/refresh` | 5 per 15 min per IP |

The auth limiter has `skipSuccessfulRequests: true` — only **failed** attempts count, so legitimate users who type their password right aren't throttled. This is exactly what you want for brute-force protection.

### The meter (RFC draft-7 headers)

With `standardHeaders: 'draft-7'`, every response carries:

```
RateLimit-Limit: 100
RateLimit-Remaining: 97
RateLimit-Reset: 842        (seconds until the window resets)
```

The frontend can read these on any response and render a live meter — no extra endpoint needed.

### What happens when you hit the limit

The middleware returns 429 with `{ success: false, message: 'Too many requests, please try again later.' }` — without ever reaching your controller. Saves DB load.

### Going multi-instance

The default store is in-memory. If you run 3 containers, a user is effectively limited to `3 × max`. For production at scale, swap in `rate-limit-redis` so counters are shared — but for a single-instance deploy this is fine.

---

## 13. Graceful shutdown

See [src/server.js](src/server.js).

### Why it matters

When you Ctrl+C or when Docker/Kubernetes sends SIGTERM:
- Dumb behaviour: process dies instantly → in-flight requests are cut off → clients see connection errors → DB connections are dangling.
- Graceful behaviour: stop accepting new requests → wait for in-flight requests → close DB pool → exit cleanly.

### The flow

```
1. SIGTERM / SIGINT received
2. server.close() → stop accepting new connections, drain existing ones
3. pool.end() → close Postgres pool
4. process.exit(0)
5. Failsafe: if steps 2-4 hang for >10 seconds, process.exit(1)
```

Plus the hardening:
```js
server.headersTimeout = 65_000;   // slow-loris: slow header attacks
server.requestTimeout = 60_000;   // total request time cap
server.keepAliveTimeout = 61_000; // max idle time on a keep-alive connection
```

---

## 14. Patterns you'll see repeated — why

### Pattern 1: `COALESCE` in UPDATE statements

```sql
UPDATE banners SET
  title = COALESCE($2, title),
  ...
WHERE id = $1
```

**Why?** So the frontend can send only the fields that changed. If `title` is `undefined`, `COALESCE(NULL, title)` keeps the old value. This gives us a "partial update" (PATCH-like) without writing dynamic SQL.

### Pattern 2: `AS "camelCase"` in SELECT

```sql
SELECT sector_id AS "sectorId", display_order AS "order" FROM categories
```

Translates DB column names to API field names so the frontend never sees `snake_case`.

### Pattern 3: Returning the row after `INSERT`

```js
const { rows } = await query('INSERT ... RETURNING id', [...]);
const created = await query(`${SELECT} WHERE id = $1`, [rows[0].id]);
res.status(201).json({ success: true, data: created.rows[0] });
```

`RETURNING id` gives us the new row's ID. Then we re-select with the `SELECT` constant that has all the camelCase aliases — so the response shape matches GET exactly. Consistency helps the frontend.

### Pattern 4: `toBool()` for multipart booleans

`multipart/form-data` sends every value as a string. So `showValue1: false` arrives as `"false"` (a truthy string!). We coerce:

```js
const toBool = (v) => ['true','1','yes','on'].includes(String(v).toLowerCase());
```

### Pattern 5: Consistent response envelope

Every successful response looks like:
```json
{ "success": true, "data": { ... } }
```
Every error looks like:
```json
{ "success": false, "message": "..." }
```
Frontend code can do `if (res.data.success) { use res.data.data } else { show res.data.message }` everywhere.

### Pattern 6: `err.code` from Postgres

`pg` errors carry SQL state codes:
- `23505` — unique violation (duplicate slug)
- `23503` — foreign key violation (sectorId doesn't exist)

Controllers translate these to friendly HTTP responses:
```js
if (err.code === '23505') return res.status(409).json({ ... });
if (err.code === '23503') return res.status(400).json({ ... });
```

### Pattern 7: `asyncHandler` wrapper

```js
export const register = asyncHandler(async (req, res) => {
  // throw anywhere — it flows to errorHandler automatically
});
```
No `try/catch` boilerplate. You either `res.json(...)` on success or `throw` on failure.

---

## 15. How to add a new resource (template)

Say you want to add **"News"** with fields `title, body, publishedAt`.

### Step 1 — Add the table to `schema.sql`
```sql
CREATE TABLE IF NOT EXISTS news (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  body         TEXT,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Then run:
```bash
psql -U postgres -d mospi_db -f src/config/schema.sql
```

### Step 2 — Create the controller `src/controllers/news.controller.js`
Copy the structure from `banner.controller.js`:
- A `SELECT` constant with `AS "camelCase"` aliases.
- `listNews`, `getNews`, `createNews`, `updateNews`, `deleteNews`.

### Step 3 — Create the route `src/routes/news.routes.js`
```js
import { Router } from 'express';
import { listNews, getNews, createNews, updateNews, deleteNews } from '../controllers/news.controller.js';

const router = Router();
router.get('/', listNews);
router.get('/:id', getNews);
router.post('/', createNews);
router.put('/:id', updateNews);
router.delete('/:id', deleteNews);
export default router;
```

### Step 4 — Mount in `src/routes/index.js`
```js
import newsRoutes from './news.routes.js';
...
router.use('/news', newsRoutes);
```

### Step 5 — Restart `npm run dev` → done.

---

## 16. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ECONNREFUSED 127.0.0.1:5432` on startup | Postgres isn't running, or wrong `PG_HOST`/`PG_PORT` in `.env`. |
| `password authentication failed for user "postgres"` | Wrong `PG_USER`/`PG_PASSWORD`. |
| `relation "users" does not exist` | You forgot to run `schema.sql`. |
| `CORS error` in browser console | The frontend's origin isn't in `CORS_ORIGIN`. Add it (comma-separated). |
| Every request gets **401 Not authenticated** | Missing `Authorization: Bearer <accessToken>` header, or token expired → use `/auth/refresh`. |
| `Access token expired` | Expected behaviour after 15 min. Call `/auth/refresh` with the refresh token to get a new pair. |
| Uploaded image URL doesn't load in browser | Check the path starts with `/uploads/…`; prefix with API base URL in the `<img>`. |
| Rate limit hits too soon while developing | Bump `RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_MAX` in `.env` during dev. |
| Server kept running after Ctrl+C | The graceful shutdown is waiting for in-flight requests. 10s later it force-exits. |
| `multer` error "Only image files are allowed" | You uploaded something that wasn't png/jpg/gif/webp/svg. |
| `duplicate key value violates unique constraint` (23505) | A slug (sector/category/kpi) is being reused. Change it. |
| `insert or update violates foreign key constraint` (23503) | The referenced `sectorId`/`categoryId`/`indicatorId` doesn't exist. |

---

## Summary — the mental model to remember

1. **Request comes in → middleware chain → router → controller → DB → response.**
2. **Controllers are thin**: parse input, call DB, send response.
3. **Middlewares are the security + observability layers**: they run before controllers so every route inherits them automatically.
4. **Two tokens**: access for every call (short), refresh to get new access (long, rotated, revocable).
5. **Hierarchy**: Sector → Category → Indicator → KPI, with cascade deletes.
6. **Icons** are just files in `/uploads` — the DB stores the URL path.
7. **Errors** always flow to one central handler via `asyncHandler` / `next(err)`.
8. **Shutdown** drains in-flight work so users don't see errors on deploys.

Bookmark this doc and re-read it as you add features. Any concept that's fuzzy, jump to its section and walk through it once more.
