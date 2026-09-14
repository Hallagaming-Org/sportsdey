# Casino Providers (index)

Quick map of casino/operator-wallet integrations in this repo.

**Detailed Spribe / LuckyWorld architecture:** [casino-provider.md](./casino-provider.md)

| Provider | Launch | Callbacks | Ledger tables |
|----------|--------|-----------|---------------|
| LuckyWorld / Spribe | `POST /casino/play/{gameCode}` | `/account/*` | `game_launch_tokens`, `game_sessions`, `game_transactions` |
| Thndr | `POST /thndr/play/{gameId}` | `/thndr/*` | `thundr_sessions`, `thundr_transactions` |
| Slotegrator | `POST /slotegrator/launch` | `/slotegrator/*` | `slotitegration_*` |
| Lagos Rush / Pockets | `POST /lagos-rush/launcher` | `/pockets/*` | `pockets_transactions` |
| Scorpio Play | **Not implemented** | seamless `command` callbacks (external docs) | — |

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
