# MOSPI Backend

Node.js + Express + PostgreSQL, ES Modules, port 5000.

## Folder structure

```
src/
├── config/
│   ├── db.js                 pg Pool
│   └── schema.sql            users, refresh_tokens, banners, sectors, categories, indicators, kpis
├── controllers/
│   ├── auth.controller.js    register / login / refresh / logout / me
│   ├── health.controller.js  liveness + readiness
│   ├── banner.controller.js
│   ├── sector.controller.js
│   ├── category.controller.js
│   ├── indicator.controller.js
│   └── kpi.controller.js
├── middlewares/
│   ├── auth.js               JWT access-token guard
│   ├── errorHandler.js       central error + 404
│   ├── logger.js             morgan HTTP logs
│   ├── rateLimiter.js        global + stricter auth limiter (meter headers)
│   ├── requestId.js          X-Request-Id correlation
│   └── upload.js             multer — stores icons to /uploads
├── routes/
│   ├── auth.routes.js
│   ├── health.routes.js
│   ├── banner.routes.js
│   ├── sector.routes.js
│   ├── category.routes.js
│   ├── indicator.routes.js
│   ├── kpi.routes.js
│   └── index.js
├── utils/
│   └── asyncHandler.js       wraps async controllers (no more try/catch noise)
├── app.js                    middleware + routing
└── server.js                 http server + graceful shutdown
uploads/                      (gitignored) icon storage
```

## Setup

```bash
npm install
cp .env.example .env          # fill in values
psql -U postgres -d mospi_db -f src/config/schema.sql
npm run dev
```

Server: http://localhost:5000

## What's new in this version

### 1. Access + Refresh token rotation
- Login now returns **two tokens**:
  - `accessToken` — short-lived (15m), sent as `Authorization: Bearer <token>` on every protected call.
  - `refreshToken` — long-lived (7d), kept by the frontend to silently renew the access token.
- Refresh tokens are stored in DB as **SHA-256 hashes** — a DB leak never exposes usable tokens.
- On every `/auth/refresh` the old refresh token is **revoked** and a new pair is issued (rotation).
- If a revoked token is replayed, **all of that user's sessions are wiped** — protects against theft.
- Logout call revokes the refresh token server-side.

### 2. Health checks (Docker / Kubernetes friendly)
- `GET /api/health` — liveness probe. Always 200 if the process is up. No DB call.
- `GET /api/health/ready` — readiness probe. Pings Postgres, reports DB latency + memory + uptime + node version. Returns **503** if the DB is unreachable.

### 3. Rate-limit meter
- Every response under `/api` includes these headers (RFC-draft-7):
  ```
  RateLimit-Limit: 100
  RateLimit-Remaining: 97
  RateLimit-Reset: 842
  ```
- The frontend can display a live "requests left" meter from these headers.
- Two tiers:
  - **Global**: `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` (default 100 / 15 min).
  - **Auth**: `AUTH_RATE_LIMIT_MAX` per window for `/auth/register|login|refresh` (default 5 / 15 min). Successful logins don't count — only failed attempts do.

### 4. Request correlation (`X-Request-Id`)
- Every request gets a UUID (or honours an upstream `X-Request-Id`).
- It's echoed back in the response header and printed in every log line — you can trace a single request end-to-end.

### 5. HTTP logging (morgan)
- Every API call is logged as `IP req-id METHOD URL STATUS BYTES - TIMEms`.
- Health checks are skipped to keep logs clean.

### 6. Gzip compression
- Responses are automatically gzipped via `compression()` — faster transfers on slower connections.

### 7. Graceful shutdown
- `SIGINT` / `SIGTERM` → stop accepting new requests, drain in-flight ones, close the DB pool, then exit. Hard-kills after 10s as a safety net.
- `headersTimeout` / `requestTimeout` / `keepAliveTimeout` tuned against slow-loris attacks.

### 8. Async error handler
- New `asyncHandler(fn)` wraps async controllers so errors automatically flow into the central error middleware — no try/catch boilerplate.

## Auth endpoints

| Method | Path                  | Body / Header                                       |
| ------ | --------------------- | --------------------------------------------------- |
| POST   | `/api/auth/register`  | `{ name, email, password }`                         |
| POST   | `/api/auth/login`     | `{ email, password }`                               |
| POST   | `/api/auth/refresh`   | `{ refreshToken }`                                  |
| POST   | `/api/auth/logout`    | `{ refreshToken }`                                  |
| GET    | `/api/auth/me`        | header `Authorization: Bearer <accessToken>`        |

**Login / register response**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "name": "…", "email": "…" },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

**Frontend flow**
1. Login → store `accessToken` in memory, `refreshToken` in an httpOnly cookie or secure storage.
2. Every API call: `Authorization: Bearer <accessToken>`.
3. On `401 "Access token expired"` → POST `/api/auth/refresh` with `refreshToken` → retry the original request with the new access token.
4. On logout: POST `/api/auth/logout` and clear both tokens locally.

## Everything else

Banners, Sectors, Categories, Indicators, KPIs — same CRUD endpoints as before, unchanged. See previous docs / your frontend forms.

## Security recap

- `helmet` secure headers · `cors` allow-list · `compression` gzip · `bcrypt` password hashes · parameterized SQL · 5 MB image-only uploads · tiered rate limits with meter headers · refresh-token rotation + hash storage · graceful shutdown · slow-loris timeouts · correlation IDs in every log.
