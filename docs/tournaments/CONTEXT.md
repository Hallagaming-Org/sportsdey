# Tournaments (Bonus Engine)

Player competitions from iGlobalSoft Bonus Engine. Distinct from Data.Bet sportsbook championships (`/football/tournament/...`, `/sportsbook/tournaments`).

Related overview: [`docs/bonus-engine/CONTEXT.md`](../bonus-engine/CONTEXT.md).

## Glossary

| Term | Meaning |
|------|---------|
| Tournament list | Bonus Engine `POST /tournament/list` rows for the merchant project |
| Join | Bonus Engine `POST /tournament/join` — opt the signed-in player in by `_id` |
| Leaderboard | Bonus Engine `POST /tournament/leaderboard` for one tournament `_id` |
| Project body | `{ client_id, project_id }` — no `user_id` on list/leaderboard |
| Join body | `{ project_id, client_id, tournamentId, user_id }` — no `status` |
| Display title | Admin `tournament_name` is often blank; UI uses `tournament_code`, then first `provider_games[].game[].name` |

## Key flows

```
Web (/tournaments)
  → SportsDey BFF GET /tournament/list
    → Bonus Engine POST /tournament/list (signed)
  → SportsDey BFF GET /tournament/leaderboard?tournamentId=
    → Bonus Engine POST /tournament/leaderboard { project_id, client_id, tournamentId } (signed)
  → SportsDey BFF POST /tournament/join { tournamentId }
    → Bonus Engine POST /tournament/join { project_id, client_id, tournamentId, user_id } (signed)
```

1. Signed-in player opens **Tournaments**.
2. UI loads the list and maps rows onto cards (status from `tournament_status` + dates, prize from `total_budget`, sport from `product`).
3. Featured card is the highest-prize **active** tournament; its leaderboard fills the table.
4. **Join now** calls `POST /tournament/join`. Join and leaderboard use camelCase `tournamentId` on both SportsDey and Bonus Engine. SportsDey injects session `user_id` on join. Cards disable Join when the session `user_id` already appears on that tournament’s leaderboard, or when join returns `User already Opted In`.

## Invariants

- Session auth on all `/tournament/*` routes. Server injects `project_id` / `client_id` (and `user_id` on join). Join must not send `status`.
- A player is opted in when their session `user_id` is on that tournament’s leaderboard (`player_id.user_id`), or join returns `User already Opted In`.
- JSON 404 on list/leaderboard maps to an empty `[]`.
- Join and leaderboard field is `tournamentId` (no `tournament_id`).
- Bonus Engine `player_tournaments` currently has a unique index on `tournament_id` alone, so a second SportsDey account cannot join after the first. Same-user retries return `User already Opted In`. iGlobalSoft needs a compound unique index on tournament + player.
- Do not confuse these rows with Data.Bet tournament / championship ids.

## Pointers

| Layer | Paths |
|-------|--------|
| Web page | `apps/web/src/routes/tournaments.index.tsx`, `apps/web/src/components/tournaments-section/*` |
| Web client | `apps/web/src/lib/tournaments.ts`, `tournaments-normalize.ts`, `tournaments.constant.ts` |
| BFF | `apps/server/src/routes/tournament.ts` |
| Engine client | `apps/server/src/services/bonus-engine/tournament.service.ts` |

### Vite local proxy

`/tournament/*` proxies to the API worker. Document navigations to `/tournaments` stay on the TanStack SPA.

## Self-check

```bash
node --import ./apps/server/node_modules/tsx/dist/loader.mjs apps/web/src/lib/tournaments.self-check.ts
cd apps/server && node --import tsx src/services/bonus-engine/tournament.self-check.ts
```
