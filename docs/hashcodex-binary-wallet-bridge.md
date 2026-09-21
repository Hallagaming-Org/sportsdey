# SportsDey Crash and Spin & Win wallet bridge

The Binary/Hashcodex game service must settle money through the SportsDey API. It must not deduct or credit a separate local game wallet for production play. Otherwise the main user bet history, wallet balance and admin ticket view cannot know that a round took place.

## Required configuration

Set these server-side values in the Binary game service for each environment:

```text
SPORTSDEY_API_URL=https://staging-api.sportsdey.com
HASHCODEX_SERVER_SECRET=<the same secret configured on the SportsDey API Worker>
```

Set `HASHCODEX_SERVER_SECRET` as a Cloudflare Worker secret on the corresponding SportsDey API environment as well. Never expose it to the browser, put it in a launch URL, or log it.

The main web app already launches the game through `POST /hashcodex/launch`. The Binary service must preserve the `playerId` and `gameCode` passed in that launch URL. `playerId` must be the SportsDey user ID, not a Binary database-only user ID.

## Signed wallet calls

The Binary service makes these server-to-server requests:

```text
POST {SPORTSDEY_API_URL}/hashcodex/wallet
Content-Type: application/json
X-Hashcodex-Signature: <lowercase HMAC-SHA256 of the exact raw JSON body>
```

For example in Node:

```js
const raw = JSON.stringify(body);
const signature = crypto
  .createHmac("sha256", process.env.HASHCODEX_SERVER_SECRET)
  .update(raw)
  .digest("hex");
```

`amount` is in naira for this callback. The SportsDey API safely converts it to kobo internally.

### When a player places a Crash bet

Use one stable, unique ID for the debit. Do not create a new ID when retrying the same request.

```json
{
  "playerId": "<SportsDey user id>",
  "action": "debit",
  "amount": 10,
  "transactionId": "crash:bet:<crash-bet-history-id>",
  "roundId": "<round_no>",
  "gameCode": "sportsdey-crash"
}
```

Only mark the Binary bet as placed after this call succeeds. If it fails, do not accept the bet.

### When a player cashes out or wins

Credit the actual payout once. `originalTransactionId` must exactly match the original debit `transactionId`.

```json
{
  "playerId": "<SportsDey user id>",
  "action": "credit",
  "amount": 31.5,
  "transactionId": "crash:win:<crash-bet-history-id>",
  "originalTransactionId": "crash:bet:<crash-bet-history-id>",
  "roundId": "<round_no>",
  "gameCode": "sportsdey-crash"
}
```

For a lost round, send no credit: the debit is the settled loss. If a round is cancelled, use `action: "refund"` with the original debit ID. The SportsDey API refunds the recorded debit amount rather than trusting a client-supplied refund amount.

For Spin & Win, use the same shape with `gameCode: "spin_and_win"` and the spin/round ID.

### Balance lookup

If the Binary service needs a displayed balance, call the signed endpoint below instead of its own wallet database:

```text
POST {SPORTSDEY_API_URL}/hashcodex/balance
```

Body:

```json
{ "playerId": "<SportsDey user id>" }
```

The response contains `data.balance` in naira.

## Verification checklist

After deploying the Worker and applying migrations `0035` and `0036`:

1. Place a losing Crash bet. One `pockets_transactions` debit must be written with `provider = hashcodex`, `game_code = sportsdey-crash`, and its `round_id`.
2. Place and cash out a second Crash bet. The callback credits the actual payout exactly once, including if the Binary service retries it.
3. In the user API, the bet history shows **Casino — SportsDey Crash**. In the admin API, the ticket shows provider **SportsDey**, game **SportsDey Crash**, and the correct round grouping.
4. Repeat the same signed callback. The wallet balance must not move again.

Existing binary-only rounds cannot safely be reconstructed by the SportsDey API without a verified export/mapping from the Binary `CrashBetHistory` records. Do not bulk-credit or backfill them automatically.
