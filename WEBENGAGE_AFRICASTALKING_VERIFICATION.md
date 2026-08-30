# WebEngage → Africa's Talking — Production Readiness Verification

**Date:** 2026-07-27  
**Scope:** Repository audit, unit tests (mocked AT), local config presence, live staging probes  
**Constraint:** No real SMS sent; secret values never printed

---

## 1. Current architecture

| Layer | Finding |
|-------|---------|
| Backend framework | **Hono** + `@hono/zod-openapi` on **Cloudflare Workers** |
| Package manager | **pnpm** workspaces (+ Turborepo) |
| HTTP client | Native `fetch`, wrapped by existing `fetchWithTimeout` |
| Config | Wrangler env + `.dev.vars` / secrets; typed in `worker-configuration.d.ts` |
| DI | None — Hono `c.env` bindings |
| Logging | `console.error` / `console.log` (Worker logs) |

### SMS path (this integration)

```
WebEngage SMS campaign / journey (Private SSP)
  → POST /webhooks/webengage/sms
       Auth: Bearer WEBENGAGE_API_SECRET | X-WebEngage-Secret
  → apps/server/src/routes/webengage-sms.ts
  → sendBulkSmsWithAfricaTalking (utils/africastalking.ts)
  → POST https://api.africastalking.com/version1/messaging/bulk
  → Recipient
```

### Separate (unchanged) paths

| Path | Role |
|------|------|
| `POST /phone-auth/request-otp` → `sendOtpWithAfricaTalking` | OTP SMS via same AT helper |
| `apps/server/src/lib/webengage.ts` | Outbound WebEngage events/users (analytics) |
| `apps/web/src/lib/webengage.ts` + `__root.tsx` | Client SDK |
| `utils/sms.ts` | Eudor ticket SMS (not Africa's Talking) |
| `routes/notifications.ts` | In-app D1 notifications |

---

## 2. Files inspected

| File | Role |
|------|------|
| `apps/server/src/routes/webengage-sms.ts` | SSP webhook |
| `apps/server/src/schemas/webengage-sms.ts` | Zod/OpenAPI schemas |
| `apps/server/src/utils/webengage-sms-auth.ts` | Timing-safe Bearer / header auth |
| `apps/server/src/utils/africastalking.ts` | Bulk SMS + phone normalize + OTP wrapper |
| `apps/server/src/utils/fetch-with-timeout.ts` | Shared upstream timeout |
| `apps/server/src/utils/africastalking.test.ts` | Unit tests |
| `apps/server/src/utils/webengage-sms.test.ts` | Webhook integration tests (mocked fetch) |
| `apps/server/src/routes/route.ts` | Mount `/webhooks/webengage` |
| `apps/server/src/index.ts` | Skip session for `/webhooks/*`; CORS headers |
| `apps/server/src/constants/cors.ts` | Allows `X-WebEngage-Secret` |
| `apps/server/src/lib/webengage.ts` | Outbound analytics |
| `apps/server/src/routes/phone-auth.ts` | OTP consumer |
| `apps/server/worker-configuration.d.ts` | Env typings |
| `apps/server/.env.example` | Documented vars |
| `apps/server/.dev.vars` | Local Wrangler secrets (gitignored) |
| `apps/server/package.json` | `test` / `test:sms` |
| Prior docs | `WEBENGAGE_AFRICASTALKING_INTEGRATION.md`, `WEBENGAGE_SMS_DEPLOYMENT.md`, `WEBENGAGE_SMS_VERIFICATION.md` |

---

## 3. Files modified (this audit)

| File | Change |
|------|--------|
| `apps/server/src/utils/africastalking.ts` | Use existing `fetchWithTimeout` (10s); map timeout/network errors to structured failure |
| `apps/server/src/routes/webengage-sms.ts` | Fix OpenAPI handler status typing for 413 (remove unsafe cast) |
| `apps/server/src/utils/webengage-sms.test.ts` | Fix mock typing for `tsc` |
| `apps/server/.dev.vars` | Add placeholder keys for AT + WebEngage (empty values; gitignored) |

---

## 4. Integration status

| Check | Result |
|-------|--------|
| Route registered in `route.ts` | **Yes** → `/webhooks/webengage` + `POST /sms` |
| Session middleware skips webhooks | **Yes** (`path.startsWith("/webhooks/")`) |
| Auth before Zod | **Yes** (middleware) |
| AT Bulk URL / headers / JSON body | **Correct** (verified by unit test assertions) |
| Phone E.164 normalization | **Yes** |
| OTP path still uses same helper | **Yes** |
| Outbound WebEngage analytics untouched | **Yes** |
| Unit tests `pnpm run test:sms` | **15/15 pass** |
| Scorpio unit tests (regression) | **13/13 pass** |
| Staging live webhook | **404 — not deployed** |
| Staging OpenAPI lists webhook | **No** (`webengage_paths []`) |

---

## 5. Environment variable audit

Presence means key exists in the named source. **Values are never printed.** Local `.dev.vars` keys were added as empty placeholders during this audit.

| Variable | `.env.example` | `.dev.vars` key | Typed bindings | Used in code | Notes |
|----------|----------------|-----------------|----------------|--------------|-------|
| `AFRICASTALKING_API_KEY` | Present | Present (empty) | Present | Used | Required for SMS send |
| `AFRICASTALKING_USERNAME` | Present | Present (empty) | Present | Used | Required for SMS send |
| `AFRICASTALKING_SENDER_ID` | Present | Present (empty) | Present | Used | Optional default sender |
| `WEBENGAGE_API_SECRET` | Present | Present (empty) | Present | Used | SSP webhook auth only |
| `WEBENGAGE_API_KEY` | Present | Present (empty) | Present | Used | Outbound analytics |
| `WEBENGAGE_LICENSE_CODE` | Present | Present (empty) | Present | Used | Outbound analytics |
| `WEBENGAGE_HOST` | Present | Present (empty) | Present | Used | Outbound analytics |

**Unused documented alias:** `# AFRICASTALKING_APP_NAME` in `.env.example` (commented; not read by server).

**Staging/production Wrangler secret values:** not verifiable from this workspace without Cloudflare auth. Prior deployment notes report invalid AT auth on staging OTP — treat live AT credentials as a **remaining ops risk**.

---

## 6. Build status

| Check | Result |
|-------|--------|
| `pnpm run test:sms` | **Pass** (15) |
| `pnpm run test:scorpio` | **Pass** (13) |
| `tsc` errors in `webengage*` / `africastalking*` | **None** (after fixes) |
| Full `apps/server` `tsc -b` | **Fails** on pre-existing unrelated modules (wallet, football, etc.) — not introduced by this integration |

---

## 7. Runtime validation results

### Local / unit (no real SMS)

| Assertion | Evidence |
|-----------|----------|
| Env bindings typed | `worker-configuration.d.ts` |
| Payload shape | `{ username, message, phoneNumbers[], senderId? }` |
| Headers | `apiKey`, `Accept`, `Content-Type: application/json` |
| Endpoint | `https://api.africastalking.com/version1/messaging/bulk` |
| Auth failures | 401 + `sms_rejected` / `2011` |
| Happy path | 200 + `sms_accepted` with mocked AT recipient status 100/101 |
| Timeout handling | AT helper returns structured failure on abort (10s) |

### Staging (live HTTP, 2026-07-27)

| Probe | HTTP |
|-------|------|
| `POST /webhooks/webengage/sms` `{}` | **404** |
| OpenAPI paths containing `webengage` | **[]** |
| `OPTIONS /phone-auth/request-otp` | **204** (API up) |
| `GET /games` | **200** |
| `POST /slotegrator/launch` | **400** (route present; auth/body fail expected) |
| `GET /scorpio/callback` | **404** (Scorpio not on this staging OpenAPI snapshot) |

---

## 8. End-to-end SMS flow

| Step | File / symbol | Exists | Wired | Reachable |
|------|---------------|--------|-------|-----------|
| WebEngage journey/campaign | Dashboard (ops) | N/A (external) | Must point at Sportsdey SSP URL | Staging URL **not live** |
| `POST /webhooks/webengage/sms` | `webengage-sms.ts` `sendSmsRoute` | Yes | `route.ts` | Local code yes; **staging 404** |
| Auth | `verifyWebengageSmsSecret` | Yes | Middleware | Unit-tested |
| Validate payload | `WebEngageSmsRequestSchema` | Yes | OpenAPI + Zod | Unit-tested |
| Normalize phone | `normalizeSmsPhoneNumber` | Yes | Handler | Unit-tested |
| Send SMS | `sendBulkSmsWithAfricaTalking` | Yes | Handler | Mocked; needs live AT secrets |
| Africa's Talking Bulk API | External | Yes | URL/headers correct | Not exercised live (no real SMS) |
| Recipient | Carrier | N/A | — | Blocked until deploy + secrets |

---

## 9. Issues found

1. **Staging Worker does not expose the webhook** (404 + missing OpenAPI path) — deploy gap.
2. **Local AT / WebEngage secrets empty** in `.dev.vars` — cannot smoke-test live AT from this machine.
3. **No automatic retries** on AT failures (by design elsewhere too); WebEngage may retry based on SSP status codes.
4. Pre-existing full-project TypeScript failures outside this integration.

---

## 10. Issues fixed

1. AT client now uses shared **`fetchWithTimeout`** (10s) with structured timeout/network errors.
2. WebEngage SMS route **413 typing** fixed for OpenAPI handler compatibility.
3. SMS test **mock typing** fixed so `tsc` no longer fails on those lines.
4. Documented empty placeholders in `.dev.vars` for required SMS/WebEngage keys.

---

## 11. Remaining risks

1. **Deploy** `apps/server` to staging/production with this branch.
2. Set Wrangler secrets: `WEBENGAGE_API_SECRET`, `AFRICASTALKING_*` (and outbound `WEBENGAGE_*` if analytics needed).
3. Configure WebEngage **Private SSP** URL + Bearer header to match Worker secret.
4. Confirm live AT credentials (prior notes: staging OTP saw AT auth failures).
5. Optional production URL: `https://api.sportsdey.com/webhooks/webengage/sms`.

See also: `WEBENGAGE_SMS_DEPLOYMENT.md`.

---

## 12. Production readiness assessment

**Repo code path:** implemented, unit-tested, wired into Hono, reuses existing AT + timeout infrastructure, does not break Scorpio unit tests or other SMS/notification modules by inspection.

**Live staging/production:** webhook **not deployed**; secrets not verified as valid.

### Verdict

🟡 **Partially Integrated**

**Remaining work**

1. Deploy Worker containing `/webhooks/webengage/sms` to staging (expect **401** without auth, not **404**).
2. Put valid `WEBENGAGE_API_SECRET` + `AFRICASTALKING_*` Wrangler secrets.
3. Register Private SSP in WebEngage dashboard.
4. One controlled smoke SMS (ops), then promote to production.
