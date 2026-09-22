# Missions

SportsDey Missions integrates with iGlobalSoft Bonus Engine for play objectives, progress, CTAs, and rewards.

Related overview: [`docs/bonus-engine/CONTEXT.md`](../bonus-engine/CONTEXT.md).  
Loyalty Club: [`docs/loyalty/README.md`](../loyalty/README.md).

## Player flow

1. Admin configures mission windows, triggers, rewards, and optional `provider_games`.
2. Player opens Missions; SportsDey proxies `GET /mission/list` to Bonus Engine (`POST /mission/list` upstream) and merges local `bonus_engine_mission_progress` snapshots onto each row. The grid and period counts show only rows with `mission_status: ACTIVE`; completed missions stay in the Completed section.
3. UI normalizes each row into a card (progress, reward, CTA).
4. CTA goes to sports, casino (optionally `?play=<game.unique_id>`), wallet, or account referral — from **trigger type** + configured games, never from game title keywords. Empty/placeholder `provider_games` on wager/bet triggers go to sportsbook.
5. Qualifying bets/deposits report to Bonus Engine (`POST /bet`, `POST /deposit`) with retries; if `waitUntil` is missing the report is awaited.
6. Engine callbacks update progress/complete. Real Cash is credited **before** ACK; wallet-missing/credit failure returns 502 so Bonus Engine can retry. Sportsbook `POST /bet` sends `sport_id`, `event_id`, and `league_id` (Championship ID). `category_id` is not required; Sport/Category/League rules match from `sport_id` + `league_id`. Stub Event IDs (`5000`/`5001`) are omitted.

## Architecture

```
Web (/missions)
  → SportsDey BFF GET /mission/list
    → Bonus Engine POST /mission/list (signed)
    → merge bonus_engine_mission_progress
Bet / deposit paths → Bonus Engine /bet|/deposit (retry + waitUntil or await)
Callbacks → /gamification/callback/mission/*
```

| Layer | Paths |
|-------|--------|
| Web page | `apps/web/src/routes/missions.index.tsx`, `apps/web/src/components/missions-section/*` |
| Web client / normalize | `apps/web/src/lib/missions.ts`, `missions-normalize.ts`, `missions.constant.ts` |
| BFF | `apps/server/src/routes/mission.ts` |
| Engine client | `apps/server/src/services/bonus-engine/mission.service.ts` |
| Bet / deposit report | `events.service.ts` (from Slotegrator / sportsbook / wallet) |
| Callbacks + snapshots | `routes/bonus-engine-callbacks.ts`, `persistence.service.ts` |
| Real Cash credit | `rewards.service.ts` |

### Vite local proxy

`/mission/*` proxies to the API worker. Document navigations to `/missions` stay on the TanStack SPA.

## CTA resolution (important)

`resolveMissionAction` in `missions-normalize.ts`:

1. Match `mission_triggers[].type` against `MISSION_TRIGGER_KEYWORD` (invite → `/account#account-referral-id`, deposit → wallet, virtual → casino, sports → sportsbook).
2. Else if `provider_games` has a real (non-placeholder) `unique_id`, deep-link `/games?play=<unique_id>`.
3. Else if wager/bet trigger with empty or placeholder `provider_games`, go to sportsbook.
4. Else if real providers exist, go to casino lobby.
5. Never classify Sports from casino game **names** (avoids “Football Golden Cup” → sportsbook).

Higher mission levels can show as locked until earlier levels are completed (`applyMissionLevelLocks`).

## Progress and rewards

- List payload is mostly campaign definition; progress % may arrive later via callbacks.
- UI derives current/target from `progress_percentage`, trigger `parameters.amount` / `min_bet`, or `missions_points`.
- Reward label prefers `mission_triggers[].parameters.rewards[]`; Points vs Real Cash.
- Card description transposes Admin trigger `type` with `parameters` (`days` into the days clause, `amount` / `min_bet` / reward into `X`). Unfilled `X` types fall back to games/leagues, then the raw type — not generic “complete the required play” copy. Real Cash is `₦` only.
- Mission complete + Real Cash → wallet credit with idempotent reference `be_mission_reward:{missionId}:{userId}`.

## Self-check

```bash
node --import ./apps/server/node_modules/tsx/dist/loader.mjs apps/web/src/lib/missions.self-check.ts
```
