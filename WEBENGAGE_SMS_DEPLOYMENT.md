# WebEngage → Africa's Talking — Production Readiness Pack

**Audience:** Engineer with Cloudflare + WebEngage dashboard access  
**Repo state:** Integration code is complete and unit-tested. Staging 404 is a **deploy gap**, not a missing route in source.  
**Do not deploy from this document alone without setting secrets.**

---

## 1. Repository audit

| Item | Finding |
|------|---------|
| Framework | **Hono** + `@hono/zod-openapi` on **Cloudflare Workers** |
| Package manager | **pnpm** (workspace monorepo + Turborepo) |
| Entrypoint | `apps/server/src/index.ts` → `export default app` |
| Route aggregator | `apps/server/src/routes/route.ts` → `app.route("/", routes)` |
| Wrangler | `apps/server/wrangler.jsonc` — env `staging` Worker `sportsdey-staging`, route `staging-api.sportsdey.com` |
| Deploy command | `cd apps/server && pnpm run deploy` (`wrangler deploy --env staging`) |
| OpenAPI | `GET /openapi.json` via `app.doc` |
| Middleware order | OPTIONS → logger → CORS → Better Auth `/auth/*` → session middleware → routes |
| WebEngage SDK (web) | `apps/web/src/routes/__root.tsx` + `apps/web/src/lib/webengage.ts` |
| WebEngage server events | `apps/server/src/lib/webengage.ts` (outbound analytics — unrelated to SSP SMS) |
| Africa’s Talking | `apps/server/src/utils/africastalking.ts` |
| New deps required? | **None.** Native `fetch`, existing `zod` / Hono. |

---

## 2. Files involved (this integration)

### Modified / added for SMS SSP

| File | Change |
|------|--------|
| `apps/server/src/routes/webengage-sms.ts` | SSP webhook (auth middleware + AT forward) |
| `apps/server/src/schemas/webengage-sms.ts` | Zod/OpenAPI schemas |
| `apps/server/src/utils/webengage-sms-auth.ts` | Bearer / `X-WebEngage-Secret` verify |
| `apps/server/src/utils/africastalking.ts` | Bulk SMS + phone normalize; OTP wrapper preserved |
| `apps/server/src/routes/route.ts` | `routes.route("/webhooks/webengage", webengageSmsRoute)` |
| `apps/server/src/index.ts` | Skip session lookup for `/webhooks/*`; CORS header allowlist |
| `apps/server/src/constants/cors.ts` | Allow `X-WebEngage-Secret` |
| `apps/server/worker-configuration.d.ts` | `WEBENGAGE_API_SECRET` typed |
| `apps/server/.env.example` | Documents required vars (no secrets) |
| `apps/server/src/utils/webengage-sms.test.ts` | Mocked local tests |
| `apps/server/src/utils/africastalking.test.ts` | Phone + schema tests |
| `apps/server/package.json` | `test:sms` script |
| `WEBENGAGE_AFRICASTALKING_INTEGRATION.md` | Architecture notes |
| `WEBENGAGE_SMS_VERIFICATION.md` | Prior verification report |

### Untouched (must stay working)

- `phone-auth.ts` OTP flow (still uses `sendOtpWithAfricaTalking`)
- `lib/webengage.ts` outbound events
- Web push / email / Eudor ticket SMS (`utils/sms.ts`)

---

## 3. Route registration verification

```
index.ts: app.route("/", routes)
route.ts: routes.route("/webhooks/webengage", webengageSmsRoute)
webengage-sms.ts: POST path "/sms"
```

**Full path:** `POST /webhooks/webengage/sms`

Session middleware **skips** `/webhooks/*` (same pattern as Scorpio callback).

---

## 4. Webhook implementation verification

| Requirement | Status |
|-------------|--------|
| Auth `Authorization: Bearer WEBENGAGE_API_SECRET` | ✅ Middleware (before Zod) |
| Auth `X-WebEngage-Secret` | ✅ |
| Invalid/missing secret → **401** | ✅ `statusCode: 2011` |
| Zod validation of WE SSP payload | ✅ + SSP-shaped 400 on failure |
| Forward to AT Bulk API | ✅ `sendBulkSmsWithAfricaTalking` |
| OTP unchanged | ✅ Wrapper intact |

AT request construction:

- URL: `https://api.africastalking.com/version1/messaging/bulk`
- Headers: `apiKey`, `Accept`, `Content-Type: application/json`
- Body: `{ username, message, phoneNumbers[], senderId? }`

---

## 5. Local testing results

```bash
cd apps/server && pnpm run test:sms
```

**Result (2026-07-27):** 15 passed, 0 failed.

Covered:

- 401 without Authorization  
- 401 wrong secret / empty `WEBENGAGE_API_SECRET`  
- 400 invalid payload after auth  
- 200 `sms_accepted` with **mocked** AT `fetch`  
- `X-WebEngage-Secret` accepted  
- Phone normalize + schema parse  

**No real SMS sent.**

---

## 6. Environment variables (usage verified — no values)

| Variable | Used by |
|----------|---------|
| `AFRICASTALKING_API_KEY` | `africastalking.ts` / webhook / phone-auth |
| `AFRICASTALKING_USERNAME` | same |
| `AFRICASTALKING_SENDER_ID` | optional default sender |
| `WEBENGAGE_API_SECRET` | SSP webhook auth **only** |
| `WEBENGAGE_API_KEY` | Outbound analytics (`lib/webengage.ts`) |
| `WEBENGAGE_LICENSE_CODE` | Outbound analytics |
| `WEBENGAGE_HOST` | Outbound analytics |

---

## 7. Deployment checklist (Cloudflare engineer)

### A. Merge / pull branch containing webhook files

Confirm these exist on the branch you deploy:

- `apps/server/src/routes/webengage-sms.ts`
- mount in `route.ts`
- skip `/webhooks/` in `index.ts`

### B. Set Wrangler secrets (staging)

```bash
cd apps/server
pnpm exec wrangler login   # if needed

pnpm exec wrangler secret put WEBENGAGE_API_SECRET --env staging
pnpm exec wrangler secret put AFRICASTALKING_API_KEY --env staging
pnpm exec wrangler secret put AFRICASTALKING_USERNAME --env staging
pnpm exec wrangler secret put AFRICASTALKING_SENDER_ID --env staging
```

**Critical:** Staging OTP currently reaches AT but gets **401 invalid authentication**. Rotate/fix AT secrets before expecting campaign SMS to work.

Optional (analytics, if not already set):

```bash
pnpm exec wrangler secret put WEBENGAGE_API_KEY --env staging
pnpm exec wrangler secret put WEBENGAGE_LICENSE_CODE --env staging
pnpm exec wrangler secret put WEBENGAGE_HOST --env staging
```

### C. Deploy

```bash
cd apps/server
pnpm run deploy
# → wrangler deploy --env staging
```

### D. Verify staging

```bash
# OpenAPI must list the path after deploy
curl -s https://staging-api.sportsdey.com/openapi.json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(Object.keys(JSON.parse(d).paths).filter(p=>p.includes('webengage'))))"

# Expect 401 (route exists), NOT 404
curl -i -X POST https://staging-api.sportsdey.com/webhooks/webengage/sms \
  -H "Content-Type: application/json" \
  -d '{}'

# Expect 200 {"status":"sms_accepted"} with valid secret + AT + real/test number
curl -i -X POST https://staging-api.sportsdey.com/webhooks/webengage/sms \
  -H "Authorization: Bearer <WEBENGAGE_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "smsData": {
      "toNumber": "234XXXXXXXXXX",
      "fromNumber": "SPORTSDEY",
      "body": "Staging SSP smoke test"
    },
    "metadata": { "messageId": "smoke-1", "campaignType": "TRANSACTIONAL" }
  }'
```

### E. Production (when ready)

Same secret puts with `--env production`, then:

```bash
pnpm run deploy:production
```

URL: `https://api.sportsdey.com/webhooks/webengage/sms`

---

## 8. Manual verification commands (expected responses)

| Command | Before deploy | After deploy (no auth) | After deploy (valid auth + AT) |
|---------|---------------|------------------------|--------------------------------|
| `POST …/webhooks/webengage/sms` `{}` | **404** | **401** + `sms_rejected` / `2011` | N/A (empty body fails later) |
| OpenAPI contains `/webhooks/webengage/sms` | **false** | **true** | **true** |
| Valid SSP body + Bearer | — | — | **200** `{"status":"sms_accepted"}` |
| OTP `POST /phone-auth/request-otp` | **502** if AT 401 | same until AT secrets fixed | **200** when AT valid |

Local (after `wrangler dev --port=8787 --env staging` + `.dev.vars`):

```bash
curl -i -X POST http://localhost:8787/webhooks/webengage/sms \
  -H "Content-Type: application/json" \
  -d '{}'
# Expect: 401
```

---

## 9. WebEngage Private SSP form values

| Field | Value |
|-------|--------|
| **SSP** | Private SSP |
| **Configuration name** | `Sportsdey Africa's Talking` (or similar) |
| **URL (staging)** | `https://staging-api.sportsdey.com/webhooks/webengage/sms` |
| **URL (production)** | `https://api.sportsdey.com/webhooks/webengage/sms` |
| **Principal Entity ID** | Leave blank unless India DLT is required |
| **ADD HEADER — name** | `Authorization` |
| **ADD HEADER — value** | `Bearer <exact WEBENGAGE_API_SECRET value stored in Wrangler>` |
| **Authentication** | Bearer (API key style). Secret must match Worker secret. |
| **Timeout** | Respond sync after AT accept; keep Worker under CF CPU limits. Prefer AT latency &lt; a few seconds. |
| **Retries** | WebEngage retries on many non-success SSP codes; we return **200 + sms_rejected** for AT soft failures to reduce duplicate sends. Auth failures are **401**. |
| **Payload** | WebEngage SSP v1/v2 (`smsData.toNumber`, `smsData.body`, `metadata.messageId`) — already supported |

Do **not** put Africa’s Talking credentials in WebEngage. Only the Sportsdey webhook URL + Bearer secret.

---

## 10. Remaining blockers (need infra access)

1. **Cloudflare deploy** of `apps/server` with this code (staging currently 404).  
2. **Valid `AFRICASTALKING_*` secrets** on staging (OTP proves invalid auth today).  
3. **`WEBENGAGE_API_SECRET`** set on Worker and matched in WebEngage header.  
4. **Save Private SSP** in WebEngage dashboard with the URL above.  
5. Optional: production deploy + DNS already points `api.sportsdey.com` at prod Worker.

---

## 11. Final verdict for repo readiness

**Code: ready for deploy.**  
**Live staging: not ready** until deploy + secrets.

Objective met: an engineer with Cloudflare access should only need to set secrets, `pnpm run deploy`, configure WebEngage SSP, and run the curl checks above.
