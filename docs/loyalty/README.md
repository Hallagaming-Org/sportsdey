# Loyalty Club

SportsDey Loyalty Club integrates with iGlobalSoft Bonus Engine for points, levels, redeem offers, and history.

Related Bonus Engine overview: [`docs/bonus-engine/CONTEXT.md`](../bonus-engine/CONTEXT.md).

## Player flow

1. Earn loyalty points from campaign rules (usually by betting).
2. Climb campaign levels as the point balance grows (`levels_criteria`).
3. Redeem when available points reach each offer’s cost (`redeem_levels_value`).
4. Track earn/redeem rows under Recent Activity.

The “How Loyalty Works” popover is built from the active campaign when `/loyalty/lists` loads; otherwise it shows generic steps.

## Architecture

```
Web (/loyalty)
  → SportsDey BFF GET /loyalty/{points|history|lists} (POST /loyalty/redeem)
    → Bonus Engine POST /loyalty/* (signed Token + Signature)
```

| Layer | Paths |
|-------|--------|
| Web page | `apps/web/src/routes/loyalty.index.tsx`, `apps/web/src/components/loyalty-section/*` |
| Web client | `apps/web/src/lib/loyalty.ts`, `loyalty-normalize.ts`, `loyalty.constant.ts` |
| BFF routes | `apps/server/src/routes/loyalty.ts` |
| Bonus Engine client | `apps/server/src/services/bonus-engine/loyalty.service.ts` |
| Icons | `apps/web/src/logos/loyalty-icons/*` (imported in `loyalty.constant.ts`) |

### Vite local proxy

`/loyalty/points`, `/loyalty/redeem`, `/loyalty/history`, and `/loyalty/lists` proxy to the API worker. Document navigations to `/loyalty` stay on the TanStack SPA (same pattern as `/games`).

## BFF contracts

All routes require an authenticated SportsDey session. The server injects Bonus Engine `client_id` / `project_id` (and `user_id` where required) and signs the body.

| SportsDey | Bonus Engine body | Notes |
|-----------|-------------------|--------|
| `GET /loyalty/points` | `{ client_id, project_id, user_id }` | `404` → zeroed points (`total_points: 0`, level `Iron`) |
| `POST /loyalty/redeem` | `{ client_id, project_id, user_id, points_to_redeem, loyalty_id? }` | Web sends `{ points_to_redeem, loyalty_id }` from the active campaign card |
| `GET /loyalty/history` | `{ client_id, project_id, user_id }` | JSON 404, engine “no history”, or `Server error while fetching loyalty history` → empty `[]` |
| `GET /loyalty/lists` | `{ client_id, project_id }` | Project-scoped; no `user_id`. `404` → empty `[]` |

Loyalty feature paths historically also accept signature as a query param; SportsDey still sends `Token` + `Signature` headers via the shared Bonus Engine client. See `BONUS_ENGINE_LOYALTY_PATHS_WITH_QUERY_SIGNATURE`.

## Campaign list payload (UI source of truth)

`GET /loyalty/lists` returns campaigns. Important fields:

| Field | UI use |
|-------|--------|
| `name`, `loyalty_status`, dates | Campaign identity / status |
| `levels_criteria[]` (`level`, `level_points`) | Tier strip + status progress (ascending by points) |
| `point_accumulate_by` | How players earn (e.g. `bet`) |
| `amount_of_point_type` / `amount_of_point_value` | Earn rate copy (e.g. `10%` of each bet) |
| `applicable_game_type` | Scope copy (e.g. all games) |
| `redeem_levels_type` / `redeem_levels_value` | Redeem category + **points cost** |
| `point_value_type` / `point_value` + `currency` | Reward figure on redeem cards (₦ / %) |

Primary campaign selection: only `loyalty_status` `ACTIVE` / `LIVE` campaigns that are inside `start_date_time`–`end_date_time`. UPCOMING/ENDED campaigns do not drive the tier strip, redeem cards, or how-it-works copy.

## Frontend mapping

| Helper | Role |
|--------|------|
| `normalizeLoyaltyPoints` | Points API → status card; uses static `LOYALTY_TIERS` until campaign levels apply |
| `applyCampaignLevelsToPointsSummary` / `buildDisplayTiersFromCampaignLevels` | Rebuild progress + strip from `levels_criteria` |
| `buildLoyaltyRedeemOffers` | One “Recommended For You” card per campaign with `redeem_levels_value > 0` |
| `buildLoyaltyHowItWorksSteps` | Popover copy from primary campaign |
| `LOYALTY_TIERS` | Icon pack + fallback ladder; campaign levels get icons by known name or ascending rank |

Redeem cards call `POST /loyalty/redeem` with that card’s `pointsCost` (`redeem_levels_value`). The button stays disabled until `availablePoints >= pointsCost`.

## Self-checks

```bash
# Web normalizers / offer builders
node --import ./apps/server/node_modules/tsx/dist/loader.mjs apps/web/src/lib/loyalty.self-check.ts

# Server outbound body shapes
cd apps/server && node --import tsx src/services/bonus-engine/loyalty.self-check.ts
```
