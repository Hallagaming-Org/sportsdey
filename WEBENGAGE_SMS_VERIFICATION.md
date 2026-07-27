# WebEngage SMS Verification Report

**Date:** 2026-07-27  
**Scope:** Read-only inspection of repository, local config files, and live staging API  
**Constraint:** No code changes; no real SMS sent; secret values never printed

---

## 1. Current Architecture

The **intended** architecture in this repository is:

```
WebEngage (SMS campaign / Private SSP)
  ↓  HTTPS POST + Bearer auth
Sportsdey Backend (Cloudflare Worker)
  ↓  POST /version1/messaging/bulk
Africa's Talking
  ↓
Mobile network
  ↓
Recipient
```

It is **not** a direct WebEngage → Africa’s Talking connection. Sportsdey is designed as a WebEngage **Private SSP** that forwards to Africa’s Talking.

**Additionally (separate, already live):**

```
Client → POST /phone-auth/request-otp → Africa’s Talking Bulk API → Recipient
```

**Also separate (not AT):** Betstack ticket SMS via Eudor (`utils/sms.ts`).

---

## 2. Existing Integration

### WebEngage (analytics / CRM — outbound)

| File | Role |
|------|------|
| `apps/web/src/lib/webengage.ts` | Client SDK wrappers (`login`, `logout`, `track`, `setAttribute`) |
| `apps/web/src/routes/__root.tsx` | JS SDK bootstrap; `webengage.init("ksa~aa13187c")` |
| `apps/web/public/service-worker.js` | WebEngage SW import (push-related) |
| `apps/server/src/lib/webengage.ts` | Server REST: events + user attributes |
| Multiple web/server call sites | `trackWebengageEvent`, `loginWebengageUser`, etc. (wallet, sportsbook, auth, news, …) |

**Endpoints (outbound to WebEngage):**  
`${WEBENGAGE_HOST}/v1/accounts/${WEBENGAGE_LICENSE_CODE}/events`  
`${WEBENGAGE_HOST}/v1/accounts/${WEBENGAGE_LICENSE_CODE}/users`

### WebEngage → SMS (inbound SSP — local code only)

| File | Role |
|------|------|
| `apps/server/src/routes/webengage-sms.ts` | SSP webhook handler |
| `apps/server/src/schemas/webengage-sms.ts` | Zod/OpenAPI request/response schemas |
| `apps/server/src/routes/route.ts` | Mount: `/webhooks/webengage` |
| `WEBENGAGE_AFRICASTALKING_INTEGRATION.md` | Integration docs |

**Endpoint:** `POST /webhooks/webengage/sms`  
**Auth:** `Authorization: Bearer WEBENGAGE_API_SECRET` or `X-WebEngage-Secret`

### Africa’s Talking

| File | Role |
|------|------|
| `apps/server/src/utils/africastalking.ts` | `sendBulkSmsWithAfricaTalking`, `sendOtpWithAfricaTalking`, `normalizeSmsPhoneNumber` |
| `apps/server/src/utils/africastalking.test.ts` | Unit tests |
| `apps/server/src/routes/phone-auth.ts` | OTP consumer of AT helper |
| `apps/server/src/routes/webengage-sms.ts` | Campaign SMS consumer of AT helper |

**HTTP endpoint called:** `https://api.africastalking.com/version1/messaging/bulk`

### Other SMS / notifications

| File | Role |
|------|------|
| `apps/server/src/utils/sms.ts` | Eudor bulk SMS (tickets) — **not** Africa’s Talking |
| `apps/server/src/routes/notifications.ts` | In-app notifications + `POST /notifications/ticket-status` |
| `apps/server/src/routes/admin-notifications.ts` | Admin in-app inbox |

### Environment variables (names)

| Variable | Declared in |
|----------|-------------|
| `AFRICASTALKING_API_KEY` | `.env.example`, `worker-configuration.d.ts`, used in phone-auth + webengage-sms |
| `AFRICASTALKING_USERNAME` | same |
| `AFRICASTALKING_SENDER_ID` | same |
| `WEBENGAGE_API_SECRET` | `.env.example`, `worker-configuration.d.ts`, used in webengage-sms |
| `WEBENGAGE_API_KEY` | outbound analytics |
| `WEBENGAGE_LICENSE_CODE` | outbound analytics |
| `WEBENGAGE_HOST` | outbound analytics |

---

## 3. WebEngage Configuration

| Check | Result | Evidence |
|-------|--------|----------|
| WebEngage SDK installed / loaded | ✅ Yes (web) | `__root.tsx` loads `widgets.ksa.webengage.com` + `webengage.init("ksa~aa13187c")` |
| WebEngage API configured (outbound) | 🟡 Code yes; local secrets no | `lib/webengage.ts` uses `WEBENGAGE_API_KEY` / `LICENSE_CODE` / `HOST`; keys **absent** from local `.dev.vars` |
| SMS channel / Private SSP in dashboard | ❓ Not verifiable from repo | User UI showed “Add SSP” form; repo cannot confirm it was saved |
| SMS provider path in backend | 🟡 Implemented locally only | `webengage-sms.ts` exists; **not on staging** (see §5) |
| SMS campaigns can reach backend | ❌ No (staging) | Live `POST …/webhooks/webengage/sms` → **HTTP 404**; OpenAPI has no that path |
| Events trigger SMS | ❌ Not in code | Outbound `track` events do **not** send SMS; SMS requires WebEngage campaign → SSP webhook |

---

## 4. Africa's Talking Configuration

| Check | Result | Evidence |
|-------|--------|----------|
| API key / username / sender in **local** `.dev.vars` | ❌ Missing | `.dev.vars` only contains Scorpio keys (names inspected; values not printed) |
| Typed / documented for Workers | ✅ Yes | `worker-configuration.d.ts`, `.env.example` |
| Staging Worker has AT bindings present | ✅ Likely present | `POST /phone-auth/request-otp` returned **502** with AT error body (not “SMS provider is not configured” 500) |
| Staging AT credentials **valid** | ❌ Invalid | Live OTP response: `providerStatus: 401`, `providerError: "The supplied authentication is invalid"` |
| HTTP bulk endpoint configured in code | ✅ Yes | Hardcoded URL in `africastalking.ts` |
| Service responsible | ✅ `sendBulkSmsWithAfricaTalking` / `sendOtpWithAfricaTalking` | `apps/server/src/utils/africastalking.ts` |

---

## 5. Communication Verification

### Intended path: User / campaign → WebEngage → Backend → AT → Recipient

| Step | File / function | Endpoint | Exists? | Complete? |
|------|-----------------|----------|---------|-----------|
| Campaign triggered in WebEngage | Dashboard (external) | — | ❓ Outside repo | Unknown if SSP saved |
| WebEngage → Sportsdey | `webengage-sms.ts` handler | `POST /webhooks/webengage/sms` | ✅ In local source | ❌ **Not deployed** to staging (404) |
| Auth | `isAuthorized` + `WEBENGAGE_API_SECRET` | Bearer / header | ✅ In code | ❌ Secret not in local `.dev.vars`; staging secret **could not be verified** (Wrangler not authenticated) |
| Normalize phone | `normalizeSmsPhoneNumber` | — | ✅ | ✅ |
| Call AT | `sendBulkSmsWithAfricaTalking` | AT bulk API | ✅ | ✅ Implementation; ❌ staging AT auth invalid |
| Recipient | Carrier | — | — | Blocked by above |

### Alternate live path: OTP → AT

| Step | Status |
|------|--------|
| `phone-auth.ts` → `sendOtpWithAfricaTalking` | ✅ Deployed on staging |
| AT accepts request | ❌ **401 invalid authentication** (verified live) |

### Git / deploy state (evidence)

- `webengage-sms.ts`, `schemas/webengage-sms.ts` are **untracked** (`??`)
- `route.ts` / `africastalking.ts` modifications are **unstaged**
- Staging OpenAPI: `has_webhook: false`, `has_phone_otp: true`
- `wrangler whoami`: **not authenticated** in this environment → cannot list/set Cloudflare secrets or deploy

---

## 6. Environment Variables

Presence only (✅ present with non-empty value / ❌ missing or empty).  
**Local workspace inspected:** `apps/server/.dev.vars`, `.env`, `.env.example`.

| Variable | `.env.example` | Local `.dev.vars` | Local `.env` | Staging Worker secrets |
|----------|----------------|-------------------|--------------|------------------------|
| `AFRICASTALKING_API_KEY` | ❌ empty placeholder | ❌ | ❌ | ❓ Cannot list (no Wrangler auth). Runtime implies **key present but invalid** (OTP 401 from AT) |
| `AFRICASTALKING_USERNAME` | ❌ empty placeholder | ❌ | ❌ | ❓ same |
| `AFRICASTALKING_SENDER_ID` | ❌ empty placeholder | ❌ | ❌ | ❓ |
| `WEBENGAGE_API_SECRET` | ❌ empty placeholder | ❌ | ❌ | ❓ Could not verify |
| `WEBENGAGE_API_KEY` | ❌ empty placeholder | ❌ | ❌ | ❓ |
| `WEBENGAGE_LICENSE_CODE` | ❌ empty placeholder | ❌ | ❌ | ❓ |
| `WEBENGAGE_HOST` | ❌ empty placeholder | ❌ | ❌ | ❓ |

---

## 7. Runtime Verification (implementation only — no SMS sent)

**Target:** `https://api.africastalking.com/version1/messaging/bulk`

From `apps/server/src/utils/africastalking.ts` (`sendBulkSmsWithAfricaTalking`):

| Aspect | Verified in code |
|--------|------------------|
| Method | `POST` |
| Headers | `Accept: application/json`, `Content-Type: application/json`, `apiKey: <AFRICASTALKING_API_KEY>` |
| Body | `{ username, message, phoneNumbers[], senderId? }` |
| Auth mechanism | `apiKey` header (AT Bulk API style) |
| Success handling | Recipient `statusCode` in `{100,101,102}` |

**Live probe (OTP path, not a campaign SMS):** staging called AT and received **401 The supplied authentication is invalid** — confirms request construction reaches AT; credentials on staging are not accepted.

**WebEngage webhook path:** cannot exercise on staging (404).

---

## 8. Missing Pieces

1. **Staging deploy** of webhook route (`POST /webhooks/webengage/sms` → 404 today).
2. **Commit / push** of webhook files (still untracked / unstaged locally).
3. **Valid Africa’s Talking credentials** on staging (present but **401 invalid**).
4. **Local `.dev.vars`** missing AT + WebEngage secrets (cannot run full local end-to-end without them).
5. **`WEBENGAGE_API_SECRET`** on staging: **not verified**; required for SSP auth after deploy.
6. **WebEngage Private SSP** URL + `Authorization: Bearer …` header: **not verified** as saved in dashboard (form was incomplete when observed).
7. **Wrangler auth** in this environment: missing → cannot deploy or inspect Cloudflare secrets here.
8. **DSN callbacks** to WebEngage: not implemented (optional for delivery stats; not required to send).
9. Event/`track` → SMS bridge: intentionally absent (campaigns use SSP, not analytics events).

---

## 9. Final Verdict

🟡 Partially Integrated

**Why:**  
Repository contains a complete **code path** WebEngage SSP → backend → Africa’s Talking Bulk API, plus a separate working **route** for OTP via AT. But end-to-end campaign SMS is **not operational**: the webhook is **not on staging**, webhook sources are **not committed**, staging AT authentication is **invalid (401)**, and WebEngage Private SSP configuration / `WEBENGAGE_API_SECRET` on Workers **could not be confirmed**.

---

## 10. Confidence Score

**88%**

Based only on:

- Source files and mounts inspected  
- Staging OpenAPI + live HTTP probes (`/webhooks/webengage/sms` 404; `/phone-auth/request-otp` 502 + AT 401 body)  
- Local `.dev.vars` key-name listing  
- Git status of webhook files  
- Wrangler `whoami` unauthenticated  

**Could not verify (explicitly):** Cloudflare secret store contents; whether WebEngage dashboard Private SSP was saved; production Worker state; whether a real campaign SMS would succeed after fix.

---

*End of verification report.*
