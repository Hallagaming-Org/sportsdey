/** Better Auth / phone OTP session lifetime (7 days). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

export const SESSION_COOKIE_NAME = "ba.session_token";
export const SECURE_SESSION_COOKIE_NAME = "__Secure-ba.session_token";
export const SESSION_HASH_COOKIE_SUFFIX = "session_token_hash";
