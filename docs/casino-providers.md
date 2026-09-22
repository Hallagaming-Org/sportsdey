# Casino Providers (index)

Quick map of casino/operator-wallet integrations in this repo.

**Detailed Spribe / LuckyWorld architecture:** [casino-provider.md](./casino-provider.md)

| Provider | Launch | Callbacks | Ledger tables |
|----------|--------|-----------|---------------|
| LuckyWorld / Spribe | `POST /casino/play/{gameCode}` | `/account/*` | `game_launch_tokens`, `game_sessions`, `game_transactions` |
| Thndr | `POST /thndr/play/{gameId}` | `/thndr/*` | `thundr_sessions`, `thundr_transactions` |
| Slotegrator | `POST /slotegrator/launch` | `/slotegrator/*` | `slotitegration_*` |
| Lagos Rush / Pockets | `POST /lagos-rush/launcher` | `/pockets/*` | `pockets_transactions` |
| Scorpio Play | `POST /scorpio/launch` | `POST /scorpio/callback` | `scorpio_players`, `scorpio_transactions` |
| Swipe Games | `POST /swipegames/launch` | `GET /swipegames/balance`, `POST /swipegames/{bet,win,refund}` | `swipegames_sessions`, `swipegames_transactions` |

**Shared:** `user`, `wallet` (and usually `wallet_transaction`).  
**No shared service layer today** for debit/credit — extract `lib/casino-wallet.ts` before adding Scorpio to avoid a fifth copy of that logic.  
**Bonus Engine reporting is shared:** every bet callback above calls `reportCasinoBetInBackground` (`services/bonus-engine/casino-bet.service.ts`) so mission progress moves. A new provider must call it too, and register its game codes in `casino-catalog.constant.ts` — see [Casino bet reporting](./bonus-engine/CONTEXT.md#casino-bet-reporting).

See [casino-provider.md §10](./casino-provider.md#10-integrating-scorpio-play-without-duplicating-business-logic).

## Scorpio Play Main API (outbound)

These are **Scorpio-hosted** endpoints. We **call** them; we do **not** mount `/v1/...` on Hono.

| Scorpio endpoint | Belongs in our codebase as | Analog |
|------------------|----------------------------|--------|
| `GET /v1/provider/list` | `utils/scorpio.ts` + CLI sync (optional admin proxy) | `cli/sync-games.ts` (Slotegrator catalog) |
| `GET /v1/game/list/:providerId` | same | same |
| `POST /v1/player/create` | called from `routes/scorpio.ts` launch (and optionally login) | Lagos Rush launcher payload / Slotegrator `player_id` |
| `POST /v1/player/info` | `utils/scorpio.ts` helper; optional route | — |
| `POST /v1/game/launch` | wrapped by our `POST /scorpio/launch` | `POST /slotegrator/launch`, `POST /lagos-rush/launcher` |
| `POST /v1/game/kick` | our `POST /scorpio/kick` (admin/user ops) | no exact analog |

**HTTP pattern:** plain `fetch` / `fetchWithTimeout` inside `utils/scorpio.ts` (like `utils/paystack.ts`), Bearer token from env — **no** shared HTTP client class exists.

**Env (Wrangler / `.env`):** `SCORPIO_API_URL` (or `SCORPIO_BASE_URL`), `SCORPIO_API_TOKEN`, `SCORPIO_CALLBACK_URL`, `SCORPIO_SERVER_IP`, `SCORPIO_ALLOWED_IPS`. Callback: `POST /scorpio/callback`.

Details: [casino-provider.md — Scorpio Main API placement](./casino-provider.md#scorpio-play-main-api-where-each-endpoint-belongs).

## Swipe Games

Types are generated from the public OpenAPI specs (`apps/server/src/integrations/swipegames/openapi/`, regenerate with `pnpm run generate:swipegames-openapi`). There is no Node SDK on Cloudflare Workers — we sign Core API calls with `SWIPEGAMES_API_KEY` and verify reverse calls with `SWIPEGAMES_INTEGRATION_API_KEY`.

| Their endpoint | Ours |
|----------------|------|
| `POST /create-new-game` | wrapped by `POST /swipegames/launch` and `/launch-demo` |
| `GET /games` | cached by `GET /swipegames/games` |
| `GET/POST/DELETE /free-rounds` | admin ` /swipegames/free-rounds` |
| Reverse `GET /balance`, `POST /bet\|win\|refund` | same paths under `/swipegames` |

Give Swipe Games this reverse-call base URL: `{SERVER_URL}/swipegames` (staging `https://staging-api.sportsdey.com/swipegames`, prod `https://api.sportsdey.com/swipegames`).

Whitelist their reverse-call IPs on `/swipegames/balance|bet|win|refund` ([docs](https://swipegames.github.io/public-api/swipegames-integration/#please-whitelist-our-ip-addresses-to-allow-requests-from-our-servers-to-your-api)): staging `18.185.156.20`, production `3.65.138.8`. Override with `SWIPEGAMES_ALLOWED_IPS`.

**Env:** `SWIPEGAMES_CID`, `SWIPEGAMES_EXT_CID`, `SWIPEGAMES_API_KEY`, `SWIPEGAMES_INTEGRATION_API_KEY`, `SWIPEGAMES_ENV` (`staging` \| `production`), `SWIPEGAMES_ALLOWED_IPS`. Schema tables need an Adnate migration before real-money play.

Amounts are NGN main-unit decimal strings (`"0.90"`); wallet stays kobo. `txID` is the idempotency key. Free-round `type: "free"` is tracking-only; bonus withdrawal is `type: "regular"` with `frID`.
