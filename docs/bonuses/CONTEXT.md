# Bonuses

Player promotional bonuses from iGlobalSoft Bonus Engine (login, deposit, and similar campaigns) with wagering, activate, and cancel.

Related overview: [`docs/bonus-engine/CONTEXT.md`](../bonus-engine/CONTEXT.md).  
Loyalty: [`docs/loyalty/README.md`](../loyalty/README.md).  
Missions: [`docs/missions/README.md`](../missions/README.md).

## Glossary

| Term | Meaning |
|------|---------|
| Campaign | Admin offer (`list_active_campaign`): code, product, reward amounts, wagering, dates |
| Assignment | Player instance (`getall_User_bonus`): `_id` is `userbonus_id`, `user_action`, `status`, remaining wagering |
| Activate | Player claims an assigned bonus; SportsDey credits wallets from assignment amounts |
| Cancel | Player drops an active assignment; engine state changes. Shared bonus wallet is not debited |
| Bonus wallet | SportsDey `game_wallet`, exposed to Bonus Engine as `bonus_wallet_balance` |
| Real wallet | SportsDey main `wallet` |

## Key flows

```
Web (/bonuses)
  → SportsDey BFF GET /bonus/{campaigns|list|getall_User_bonus}; POST /bonus/{activate|cancel}
    → Bonus Engine POST /list_active_campaign | /getall_User_bonus | /activate_bonus | /cancel_bonus
Activate success → credit game_wallet (bonus_amount) and/or wallet (cash_amount)
Bets / deposits already report via existing /bet and /deposit
```

1. Admin publishes a campaign. Engine may assign it via `POST /bonus-engine/callback/bonusAllocation` (stored locally) and/or `getall_User_bonus`.
2. Player opens **Bonuses**. UI loads assignments and the campaign catalog in parallel. Available offers always send `bonus_type` (default **welcome**); the type filter matches Admin.
3. After **sign-in**, a root modal offers the first ready **welcome** then **login** assignment (`userbonus_id` required). After a **successful deposit**, the same modal offers a ready **deposit** assignment (list is refetched because allocation can lag). Dismiss/activate is remembered for that tab until logout.
4. **Activate** calls Bonus Engine, then credits SportsDey wallets from the assignment’s `bonus_amount` / `cash_amount` (major units → kobo). Engine-returned balances are overwritten with SportsDey figures.
5. Play CTA uses product type + allow-listed game `id` (`/games?play=`), or sportsbook / wallet. Game **titles** are never classified as sports. Vendor ids may not match Slotegrator or Data.Bet catalogs.
6. Wagering progress depends on existing bet/deposit reports, not a new ping. Sportsbook reports send `sport_id` / `event_id` / `league_id` (no `category_id`); casino reports send `provider_id` / `game_id`.
7. Engine `updateBonus` (EXPIRED / CANCELED / LOST / COMPLETED) applies amount changes to SportsDey wallets and updates the local snapshot status.

## Invariants

- Session auth on all `/bonus/*` routes. Server injects `client_id` / `project_id` / `user_id`. `GET /bonus/campaigns` always forwards `bonus_type` (default `welcome`).
- Never write engine wallet figures onto SportsDey wallets.
- Activate credit is idempotent per `be_bonus_activate:{userbonusId}:{userId}:{bonus|cash}`.
- Wallet-missing on credit after a successful activate returns **502** so the client can retry (activate is treated as accepted if the engine says already activated).
- Cancel is proxy-only: one shared `game_wallet` must not be emptied for a single assignment.
- Allocation that arrives already `ACTIVATED` / `ACTIVE` credits with the same activate idempotency keys (no double credit if the player also taps Activate).
- `updateBonus` applies signed amount **changes**, not engine absolute balances. Positive `bonus_amount_change` leaves `game_wallet`.
- `404` on list/campaigns → empty `[]`, then overlay local `bonus_engine_user_bonus` snapshots.

## Pointers

| Layer | Paths |
|-------|--------|
| Web page | `apps/web/src/routes/bonuses.index.tsx`, `apps/web/src/components/bonuses-section/*`, `bonus-offer-host.tsx` |
| Web client | `apps/web/src/lib/bonuses.ts`, `bonuses-normalize.ts`, `bonuses.constant.ts` |
| BFF | `apps/server/src/routes/bonus.ts` |
| Engine client | `apps/server/src/services/bonus-engine/bonus.service.ts` |
| Wallet credit | `apps/server/src/services/bonus-engine/rewards.service.ts` (`creditBonusActivation`, `applyBonusStatusWalletChanges`) |
| Inbound callbacks | `apps/server/src/routes/bonus-engine-callbacks.ts` (`/bonus-engine/callback/{balance,updateBonus,bonusAllocation}`) |
| Local snapshots | D1 `bonus_engine_user_bonus` (migration `0029_bonus_engine_user_bonus`) |

### Vite local proxy

`/bonus/*` proxies to the API worker. Document navigations to `/bonuses` stay on the TanStack SPA.

## Self-checks

```bash
node --import ./apps/server/node_modules/tsx/dist/loader.mjs apps/web/src/lib/bonuses.self-check.ts
cd apps/server && node --import tsx src/services/bonus-engine/bonus.self-check.ts
```
