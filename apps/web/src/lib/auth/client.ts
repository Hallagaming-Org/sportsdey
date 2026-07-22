import { createAuthClient } from "better-auth/react";
import { apiRequest } from "@/lib/api";
import {
	clearStoredSessionToken,
	getStoredSessionToken,
	storeSessionToken,
} from "@/lib/auth/session-token";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_SERVER_URL,
	basePath: "/auth",
	fetchOptions: {
		credentials: "include",
		onRequest(context) {
			const token = getStoredSessionToken();
			if (token) {
				const headers = new Headers(context.headers);
				if (!headers.has("Authorization")) {
					headers.set("Authorization", `Bearer ${token}`);
				}
				context.headers = headers;
			}
			return context;
		},
	},
});

export const { signIn, signUp, useSession, getSession, changeEmail } = authClient;

export async function signOut(
	...args: Parameters<typeof authClient.signOut>
) {
	clearStoredSessionToken();
	return authClient.signOut(...args);
}

export async function requestPhoneOtp(phoneNumber: string) {
	return apiRequest<{ message: string }>("phone-auth/request-otp", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ phoneNumber }),
	});
}

export type PhoneOtpUser = {
	id: string;
	name: string;
	email: string;
	mobileNumber: string | null;
};

type VerifyPhoneOtpResult = {
	message: string;
	/** Raw session token used as Authorization Bearer (server re-signs when needed). */
	token?: string;
	authToken?: string;
	expiresAt?: string;
	user: PhoneOtpUser;
	isFirstTimeSignIn?: boolean;
	needsProfileCompletion?: boolean;
};

/** Prefer raw DB session token; fall back to signed `set-auth-token` (token.signature). */
function resolveSessionTokenFromVerify(opts: {
	bodyToken?: string;
	authToken?: string;
	headerToken?: string | null;
}): string | null {
	if (opts.bodyToken?.trim()) return opts.bodyToken.trim();

	const signed =
		opts.authToken?.trim() ||
		opts.headerToken?.trim() ||
		"";
	if (!signed) return null;

	// Signed Better Auth tokens are `rawToken.base64Signature`.
	const raw = signed.includes(".") ? signed.slice(0, signed.indexOf(".")) : signed;
	return raw || null;
}

export async function verifyPhoneOtp(phoneNumber: string, otp: string) {
	// Use a dedicated fetch so we can read `set-auth-token` (apiRequest only returns JSON).
	const baseUrl =
		import.meta.env.VITE_SERVER_URL ||
		import.meta.env.VITE_API_URL ||
		"https://staging-api.sportsdey.com/";
	const response = await fetch(`${baseUrl}phone-auth/verify-otp`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ phoneNumber, otp }),
	});

	const json = (await response.json()) as {
		success?: boolean;
		data?: VerifyPhoneOtpResult;
		error?: string;
	};

	if (!response.ok || !json.data) {
		throw new Error(json.error || "Invalid OTP. Please try again.");
	}

	const data = json.data;
	const token = resolveSessionTokenFromVerify({
		bodyToken: data.token,
		authToken: data.authToken,
		headerToken:
			response.headers.get("set-auth-token") ||
			response.headers.get("Set-Auth-Token"),
	});

	if (!token) {
		throw new Error(
			"Sign-in succeeded but no session token was returned. Please try again.",
		);
	}

	storeSessionToken(token);

	return { ...data, token };
}
