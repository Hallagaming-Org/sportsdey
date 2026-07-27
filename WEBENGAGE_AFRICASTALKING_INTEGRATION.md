# WebEngage + Africa's Talking SMS Integration

## Architecture

```
WebEngage SMS campaign / journey
  → POST /webhooks/webengage/sms  (Bearer WEBENGAGE_API_SECRET)
  → apps/server/src/routes/webengage-sms.ts
  → sendBulkSmsWithAfricaTalking (apps/server/src/utils/africastalking.ts)
  → POST https://api.africastalking.com/version1/messaging/bulk
  → Recipient
```

Sportsdey acts as a **WebEngage SMS Service Provider (SSP)** endpoint and reuses the existing Africa's Talking Bulk SMS helper used by phone OTP.

**Out of scope / unchanged**

- Outbound WebEngage analytics (`lib/webengage.ts`, web SDK)
- Betstack ticket SMS via Eudor (`utils/sms.ts`, `POST /notifications/ticket-status`)
- In-app D1 notifications

## Data flow

1. WebEngage POSTs JSON (`version` + `smsData` + `metadata`) with `Authorization: Bearer <API_KEY>`.
2. Handler validates secret (`WEBENGAGE_API_SECRET`), payload version (`1.0` | `2.0`), body, and phone.
3. Phone is normalized to E.164 (`normalizeSmsPhoneNumber`).
4. Message is sent with existing AT credentials (`AFRICASTALKING_*`).
5. Response follows WebEngage SSP contract (`sms_accepted` / `sms_rejected` + status codes), not the usual `{ success, data }` envelope.

## Configuration / environment variables

Set as Wrangler secrets (local: `apps/server/.dev.vars`):

| Variable | Purpose |
|----------|---------|
| `AFRICASTALKING_API_KEY` | AT Bulk API key |
| `AFRICASTALKING_USERNAME` | AT username |
| `AFRICASTALKING_SENDER_ID` | Default sender if WebEngage `fromNumber` empty |
| `WEBENGAGE_API_SECRET` | Bearer token WebEngage must send to this webhook |
| `WEBENGAGE_API_KEY` | Existing outbound Events/Users API (unchanged) |
| `WEBENGAGE_LICENSE_CODE` | Existing outbound API |
| `WEBENGAGE_HOST` | Existing outbound API host |

See `apps/server/.env.example`.

## API endpoint

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/webhooks/webengage/sms` | `Authorization: Bearer <WEBENGAGE_API_SECRET>` or `X-WebEngage-Secret` |

**Staging example:** `https://staging-api.sportsdey.com/webhooks/webengage/sms`  
**Production example:** `https://api.sportsdey.com/webhooks/webengage/sms`

### Request (WebEngage SSP)

```json
{
  "version": "1.0",
  "smsData": {
    "toNumber": "2348012345678",
    "fromNumber": "SPORTSDEY",
    "body": "Your message text"
  },
  "metadata": {
    "campaignType": "TRANSACTIONAL",
    "timestamp": "2018-01-25T10:24:16+0000",
    "messageId": "webengage-message-id"
  }
}
```

### Success response

```json
{ "status": "sms_accepted" }
```

### Failure response (examples)

```json
{ "status": "sms_rejected", "statusCode": 2011, "message": "Authentication failure" }
```

```json
{ "status": "sms_rejected", "statusCode": 2003, "message": "Invalid mobile number" }
```

Status codes follow [WebEngage SSP docs](https://docs.webengage.com/docs/self-service-platform-ssp).

## Files

| File | Role |
|------|------|
| `apps/server/src/utils/africastalking.ts` | Bulk SMS + phone normalize; OTP wrapper |
| `apps/server/src/routes/webengage-sms.ts` | SSP webhook |
| `apps/server/src/schemas/webengage-sms.ts` | Zod/OpenAPI schemas |
| `apps/server/src/routes/route.ts` | Mount `/webhooks/webengage` |
| `apps/server/src/utils/africastalking.test.ts` | Unit tests |

## WebEngage dashboard setup

1. Integrations → SMS → add custom SSP (or private SSP with WebEngage support).
2. Endpoint URL: `https://<api-host>/webhooks/webengage/sms`
3. Auth: **Bearer** API key = same value as `WEBENGAGE_API_SECRET` in Wrangler.
4. Send a test campaign to a Nigerian MSISDN.

## Testing steps

```bash
# Unit
cd apps/server && node --import tsx --test src/utils/africastalking.test.ts

# Manual (local API on :8787 or :3000)
curl -s -X POST http://localhost:8787/webhooks/webengage/sms \
  -H "Authorization: Bearer $WEBENGAGE_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "smsData": {
      "toNumber": "2348012345678",
      "fromNumber": "SPORTSDEY",
      "body": "Sportsdey WebEngage SMS test"
    },
    "metadata": { "messageId": "local-test-1", "campaignType": "TRANSACTIONAL" }
  }'
```

Expect `{ "status": "sms_accepted" }` when AT credentials are valid.

## Deployment

1. Set `WEBENGAGE_API_SECRET` (and ensure `AFRICASTALKING_*` exist) on staging/production Workers.
2. Deploy API: `cd apps/server && pnpm run deploy` (or `deploy:production`).
3. Point WebEngage SSP URL at the deployed host.
4. Merge alone does **not** update live Workers — Wrangler deploy is required.

## Retry / error handling

- Auth failure → HTTP 401 + `statusCode` 2011 (WebEngage should not treat as soft success).
- Invalid body/phone → HTTP 400 + SSP codes (`2002`, `2003`, …).
- AT soft failure → HTTP 200 + `sms_rejected` / `9988` (avoids aggressive WE retries for config errors; adjust if you prefer WE retries on AT outages).
- No app-level queue; one request → one AT send. WebEngage may retry on non-2xx per their backoff.

## Rollback plan

1. Remove or rotate `WEBENGAGE_API_SECRET` so the webhook rejects traffic.
2. Or redeploy previous Worker version without `/webhooks/webengage`.
3. Disable the SSP / switch campaigns off in WebEngage dashboard.
4. OTP phone-auth remains independent (same AT util).

## Future maintenance

- Optional: Delivery Status Notifications (DSN) back to WebEngage `st.*.webengage.com/tracking/events`.
- Optional: D1 idempotency on `metadata.messageId` to de-dupe WE retries.
- Optional: migrate Betstack ticket SMS from Eudor to Africa's Talking.
- Do not route marketing SMS through `utils/sms.ts` (Eudor).
