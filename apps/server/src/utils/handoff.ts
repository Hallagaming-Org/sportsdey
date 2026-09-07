import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared SSO handoff primitives for POST /handoff/code (issue) and
 * POST /handoff/exchange (redeem). Kept in one place so the key prefix,
 * TTL and payload shape can never drift between the two endpoints.
 */

/** Cloudflare KV rejects an expirationTtl below 60; the spec fixes it at 60. */
export const HANDOFF_TTL_SECONDS = 60;
export const HANDOFF_KEY_PREFIX = "handoff:";
export const HANDOFF_TOKEN_BYTES = 32;
/** Marks the record as minted by this flow, so a stray key cannot be redeemed. */
export const HANDOFF_ISSUER = "sportsdey:sso-handoff";
export const HANDOFF_VERSION = 1;

/** 32 random bytes as lowercase hex — 64 chars. */
const HANDOFF_CODE_PATTERN = new RegExp(
	`^[0-9a-f]{${HANDOFF_TOKEN_BYTES * 2}}$`,
);

export type HandoffPayload = {
	iss: typeof HANDOFF_ISSUER;
	v: number;
	userId: string;
	createdAt: number;
};

/**
 * The staging binding is declared as `staging-kv`, so it is only reachable via
 * index access — `env.staging_kv` is always undefined. There is no
 * SSO_TOKENS_KV binding in this project; the handoff records live here.
 */
export function getHandoffKvNamespace(env: any): any {
	return env.sportsdey_ns || env["staging-kv"] || env.staging_kv || null;
}

/** Opaque, cryptographically random. Carries no user data. */
export function generateHandoffCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(HANDOFF_TOKEN_BYTES));
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/** Cheap shape check so malformed input never reaches KV. */
export function isValidHandoffCodeFormat(code: string): boolean {
	return HANDOFF_CODE_PATTERN.test(code);
}

export function handoffKey(code: string): string {
	return `${HANDOFF_KEY_PREFIX}${code}`;
}

export function buildHandoffPayload(userId: string): HandoffPayload {
	return {
		iss: HANDOFF_ISSUER,
		v: HANDOFF_VERSION,
		userId,
		createdAt: Date.now(),
	};
}

/**
 * Parses a KV record, rejecting anything this flow did not mint.
 * Expiry itself is enforced by the KV TTL — an expired record is simply absent.
 */
export function parseHandoffPayload(raw: string | null): HandoffPayload | null {
	if (!raw) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (typeof parsed !== "object" || parsed === null) return null;
	const payload = parsed as Record<string, unknown>;

	if (payload.iss !== HANDOFF_ISSUER) return null;
	if (payload.v !== HANDOFF_VERSION) return null;
	if (typeof payload.userId !== "string" || !payload.userId) return null;
	if (typeof payload.createdAt !== "number") return null;

	return payload as HandoffPayload;
}

/**
 * sha256 of the client id alone, hex. Safe to hand to the browser: it
 * identifies the client without revealing the raw id, and it is NOT the
 * exchange token — that one mixes in the secret and must stay server-side.
 */
export function computeHashedClientId(clientId: string): string {
	return createHash("sha256").update(clientId).digest("hex");
}

/**
 * Expected sso_exchange_token: sha256 of client id + client secret, hex.
 * Halla computes the same value from the shared credentials.
 */
export function computeSsoExchangeToken(
	clientId: string,
	clientSecret: string,
): string {
	return createHash("sha256")
		.update(`${clientId}${clientSecret}`)
		.digest("hex");
}


// Secure constant-time comparison helper
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}