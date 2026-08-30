# Staging Root Cause Report — Casino 404 / Scorpio / Popular Matches

**Date:** 2026-07-27  
**Environment:** `https://stagingweb.sportsdey.com` → `https://staging-api.sportsdey.com`  
**Branch with fix code:** `feature/scorpio-play-integration`  
**Debug session:** `17192a`

---

## Executive verdict

Casino fails on staging because the **staging API Worker does not expose any `/scorpio/*` routes**, while the **deployed Casino UI is Scorpio-only** and calls `GET scorpio/providers`. That request returns plain `404 Not Found`, which the frontend surfaces as **"Unexpected server response (404)"**.

Classic catalog (`GET /games`) and Slotegrator (`POST /slotegrator/launch`) are alive on staging. Popular Matches (football) routes are alive. Staging is unstable primarily because **web and API were deployed out of sync** (Scorpio UI without Scorpio API), not because Slotegrator or football were deleted.

---

## 1. Broken endpoints

| Endpoint | Staging status | Expected | Notes |
|----------|----------------|----------|-------|
| `GET /scorpio/providers` | **404** | 200 | Primary Casino failure |
| `GET /scorpio/games/{providerId}` | **404** | 200 | Catalog follow-up |
| `POST /scorpio/launch` | **404** | 401/400 when unauth/invalid | Launch missing entirely |
| All other `/scorpio/*` | **Absent from OpenAPI** | Present | 0 Scorpio paths in staging OpenAPI |
| `GET /games` | **200** | 200 | Classic/Slotegrator catalog OK (~1000+ games) |
| `POST /slotegrator/launch` | **400** (Zod) | 400/401 without body/auth | Route exists |
| Football routes | **Present** (e.g. 400 Zod on bad query) | Present | Popular Matches backend OK |

Staging OpenAPI (`/openapi.json`): **145 paths**, `scorpio: []`, includes `/games`, `/slotegrator/launch`, `/football/*`.

Local OpenAPI (same codebase, `wrangler dev --env staging`): **14 Scorpio paths** including `/scorpio/providers`, `/scorpio/games/{providerId}`, `/scorpio/launch`.

---

## 2. Root cause of each issue

### Casino — “Unexpected server response (404)”

**Trace:**

```
Casino page (stagingweb /games)
  → queryKey ["scorpio-games"] only (deployed bundle games-C9qnWbTK.js)
  → fetchScorpioLobbyGames()
  → apiRequest("scorpio/providers")
  → https://staging-api.sportsdey.com/scorpio/providers
  → Cloudflare Worker: no matching route
  → plain text "404 Not Found"
  → api.ts cannot parse JSON error body
  → ApiError: "Unexpected server response (404)"
  → full-page error + Retry
```

**Why 404:** Endpoint was **not deleted from the feature branch**; it was **never (or no longer) deployed** on the staging Worker. `origin/main` does **not** mount Scorpio. `feature/scorpio-play-integration` **does** (`routes.route("/scorpio", scorpioRoute)`).

**Not:** renamed path, DI failure, or wrong prefix on a live controller. OpenAPI proves the controller is absent from the deployed Worker.

### Debug CORS noise (`127.0.0.1:7907`)

Deployed `scorpio-catalog-*.js` still contains **6** references to `http://127.0.0.1:7907/ingest/...` (leftover agent debug ingest). Browser Private Network Access blocks it. **Noise only** — not the Casino 404 cause. Local working tree no longer embeds that in production source (instrumentation is session-local and must be removed before production deploy).

### Popular Matches

Staging home screenshot shows Popular Matches rendering odds. Staging API still exposes football routes. **No shared football/Popular Matches route was removed by Scorpio work.** Any perceived impact was likely:

- Hot Casino tab failing (same Scorpio 404), or
- General staging instability perception while Casino broke.

---

## 3. Files modified (this session / working tree)

### Backend (already on feature branch; must be **deployed**)

- `apps/server/src/routes/route.ts` — mounts `/scorpio`
- `apps/server/src/routes/scorpio.ts` — full Scorpio API (+ temporary debug logs)
- Scorpio utils/schemas/config (existing feature commits)

### Frontend (working tree — dual lobby resilience; **must be committed + deployed**)

- `apps/web/src/routes/games.tsx` — merge Classic + Scorpio; fatal only if **both** fail
- `apps/web/src/lib/classic-lobby.ts` — `GET /games` catalog helper (**untracked** until committed)
- `apps/web/src/lib/scorpio-catalog.ts` — Scorpio catalog client
- `apps/web/src/components/PopularAndCasinoSection.tsx` — soft-fail dual fetch
- `apps/web/src/components/sidebar.tsx`, `game.$gameId.tsx`, `server-url.ts`, `vite.config.ts`

---

## 4. Routes that must exist after staging API deploy

From local OpenAPI (authoritative for this branch):

- `GET /scorpio/providers`
- `GET /scorpio/games/{providerId}`
- `POST /scorpio/launch`
- `POST /scorpio/callback` (+ GET health)
- `GET /scorpio/providers/settings`, kick, player, operator, transactions, bonus-call, …

Slotegrator (already on staging):

- `POST /slotegrator/launch`
- Wallet callback under `/slotegrator`

Classic catalog (already on staging):

- `GET /games`, `GET /games/{id}`, enable/disable

---

## 5. Backend fixes required

1. **Deploy** `apps/server` from `feature/scorpio-play-integration` to staging:
   ```bash
   cd apps/server
   npx wrangler login   # currently: not authenticated
   pnpm run deploy:staging
   ```
2. **Set Cloudflare Worker secrets** for staging (same names as `.dev.vars` / `.env.example`):
   - `SCORPIO_API_URL` / `SCORPIO_BASE_URL`
   - `SCORPIO_API_TOKEN`
   - `SCORPIO_CALLBACK_URL` (staging callback URL)
   - `SCORPIO_SERVER_IP`, `SCORPIO_ALLOWED_IPS` as required
3. **Verify** after deploy:
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://staging-api.sportsdey.com/scorpio/providers
   # expect 200 (or 500 only if secrets missing — never 404)
   curl -sS https://staging-api.sportsdey.com/openapi.json | jq '[.paths|keys[]|select(contains("scorpio"))]'
   ```

Without this deploy, **no frontend change alone** can make staging Scorpio return 200.

---

## 6. Frontend fixes required

1. Deploy Casino that:
   - Fetches **both** Classic (`GET /games`) and Scorpio
   - Shows Classic if Scorpio fails (no full-page 404)
   - **Does not** ship `127.0.0.1:7907` ingest calls
2. Commit + deploy working-tree dual-lobby files, then:
   ```bash
   cd apps/web
   pnpm run deploy:staging
   ```

---

## 7. Why staging failed

| Layer | What shipped | What should have shipped |
|-------|----------------|---------------------------|
| Staging web | Scorpio-only Casino + debug ingest | Dual lobby (or Scorpio UI **with** Scorpio API) |
| Staging API | Main-like Worker: Slotegrator + `/games`, **no Scorpio** | Feature Worker with `/scorpio` mounted + secrets |
| Git | Scorpio lives on `feature/scorpio-play-integration`; `origin/main` has no Scorpio mount | Staging should track the feature deploy (or merge then deploy) |

---

## 8. Why Casino returned 404

Frontend called `scorpio/providers` → staging Worker had **no route** → Cloudflare/Hono **404 Not Found** (plain text) → UI error string from `apps/web/src/lib/api.ts` when JSON parse of the error body fails.

---

## 9. Why Popular Matches appeared affected

Backend football routes remain registered on staging OpenAPI. Home Popular Matches still rendered in staging screenshots. The regression center is **Casino/Scorpio deploy mismatch**; Popular Matches was not broken by a deleted shared sports API. Hot Casino (Scorpio) on the same home widget can fail independently.

---

## 10. Verification evidence

### Staging (broken — runtime)

```
GET  https://staging-api.sportsdey.com/scorpio/providers  → 404
POST https://staging-api.sportsdey.com/scorpio/launch     → 404
GET  https://staging-api.sportsdey.com/games?limit=2      → 200
POST https://staging-api.sportsdey.com/slotegrator/launch → 400 Zod (route alive)
OpenAPI scorpio paths → []
Deployed games bundle queryKey → ["scorpio-games"] only; no classic-lobby
Deployed scorpio-catalog → contains 127.0.0.1:7907 (×6)
```

### Local (same branch — healthy registration)

```
OpenAPI scorpio path count → 14
GET /scorpio/providers → 200 (after warm-up; intermittent upstream 503 possible)
GET /scorpio/games/1 → 200
GET /games → 200
stagingProvidersStatus vs local → 404 vs routes present
```

### Hypothesis evaluation

| ID | Hypothesis | Result |
|----|------------|--------|
| A | Staging API missing Scorpio routes | **CONFIRMED** (404 + empty OpenAPI; local has 14 paths) |
| B | Classic `/games` / Slotegrator broken | **REJECTED** (200 / Zod 400 on staging) |
| C | Staging web Scorpio-only + debug ingest | **CONFIRMED** (bundle analysis) |
| D | Branch/deploy mismatch (main vs feature) | **CONFIRMED** (`origin/main` has no scorpio mount) |
| E | Popular Matches football API deleted | **REJECTED** (routes present; UI rendered matches) |

---

## Blocker for completing Phase 7 on cloud staging

```
npx wrangler whoami → You are not authenticated. Please run wrangler login.
gh auth status → Bad credentials (token invalid)
```

**Permanent fix = authenticate + deploy server (with SCORPIO secrets) + deploy dual-lobby web.** Code on this branch already implements Scorpio; staging simply is not running that Worker build.

### Deploy once authenticated

```bash
# Option A — interactive OAuth (run in your own terminal)
cd apps/server && npx wrangler login

# Option B — API token
export CLOUDFLARE_API_TOKEN=...   # Account → Workers Scripts Edit

# Then:
./scripts/deploy-staging-scorpio.sh
```

This script syncs `SCORPIO_*` from `apps/server/.dev.vars`, deploys API + web, and smokes `scorpio/providers` + `/games`.

Debug ingest calls are gated behind `import.meta.env.DEV` so staging builds will **not** ship `127.0.0.1:7907` CORS noise.

---

## Post-deploy checklist

- [ ] `GET /scorpio/providers` → 200  
- [ ] OpenAPI lists `/scorpio/*`  
- [ ] `https://stagingweb.sportsdey.com/games` loads games (Classic and/or Scorpio)  
- [ ] No full-page “Unexpected server response (404)”  
- [ ] No console calls to `127.0.0.1:7907`  
- [ ] Home Popular Matches still loads  
- [ ] `POST /slotegrator/launch` still registered  
- [ ] Remove debug `#region agent log` instrumentation before production cutover  
