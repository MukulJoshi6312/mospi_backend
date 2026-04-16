# Postman setup

Two files in this folder:

| File | Purpose |
|---|---|
| `MOSPI-Backend.postman_collection.json` | All API endpoints, grouped by resource |
| `MOSPI-Local.postman_environment.json`  | Variables (baseUrl, tokens, IDs) |

## Import (one time)

1. Open **Postman**.
2. Top-left → **Import** → **Files** → pick **both** JSON files.
3. Top-right environment dropdown → select **MOSPI Local**.

That's it. `{{baseUrl}}` already points at `http://localhost:4000/api`.

## How to use it

### 1. Run `Auth → Register` (once)
Creates a user. The test script auto-saves `accessToken`, `refreshToken` and `userId` to the environment.

Default body:
```json
{ "name": "Admin User", "email": "admin@mospi.gov.in", "password": "Admin@12345" }
```

### 2. Or run `Auth → Login` (after the user exists)
Same auto-save behaviour. The collection-level auth uses `Bearer {{accessToken}}` so every protected request works automatically.

### 3. Hit any other endpoint
- Collection auth is `Bearer {{accessToken}}` → already attached.
- `baseUrl`, `sectorId`, `categoryId`, `indicatorId`, `kpiId`, `bannerId` are environment variables. When you `Create` a sector/category/indicator/kpi/banner, the `id` returned is automatically saved to the matching variable, so the next `Get/Update/Delete` in that folder just works.

### 4. Token expired?
Run `Auth → Refresh token`. It reads `{{refreshToken}}` from the environment and saves the new pair.

## Adding an image file (multipart endpoints)

For Sectors / Categories / Indicators / KPIs:

1. Open the `Create …` request.
2. Go to **Body → form-data**.
3. Find the file field (`icon`, `categoryIcon`, `indicatorIcon`, or `KpiIcon`).
4. On the right side of that row, click **Select Files** and pick any PNG/JPG (≤ 5 MB).
5. **Send**.

The response's `data.icon` / `data.categoryIcon` / etc. is a relative path like `/uploads/1728...png`. To view the image, hit `http://localhost:4000/uploads/<filename>` directly in the browser.

## Suggested test order (end-to-end)

1. **Health → Readiness** → confirms the server + DB are up.
2. **Auth → Register** → creates a user, saves tokens.
3. **Auth → Me** → confirms the token works.
4. **Sectors → Create sector** → saves `sectorId`.
5. **Categories → Create category** → uses `sectorId`, saves `categoryId`.
6. **Indicators → Create indicator** → uses both, saves `indicatorId`.
7. **KPIs → Create KPI** → uses all three, saves `kpiId`.
8. **Banners → Create banner** → saves `bannerId`.
9. **KPIs → List by indicator** → filter by `indicatorId`.
10. **Auth → Logout** → revokes refresh token.

## Troubleshooting

| Response | Meaning | Fix |
|---|---|---|
| `Could not get any response` | Server isn't running | `npm run dev` |
| `404 Route not found` | Wrong path or baseUrl | Check `{{baseUrl}}` = `http://localhost:4000/api` |
| `401 Not authenticated` | No Bearer token | Run Login first |
| `401 Access token expired` | 15 min passed | Run `Auth → Refresh token` |
| `409 categorySlug already exists` | Slug collision | Change the slug to something new |
| `400 sectorId does not exist` | FK missing | Create the parent first |
| `Only image files are allowed` | Non-image upload | Use PNG/JPG/GIF/WEBP/SVG ≤ 5 MB |
| `429 Too many requests` | Hit rate limit | Wait 15 min or bump `RATE_LIMIT_MAX` in `.env` |
