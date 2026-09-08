import { createAuthClient } from "better-auth/react";
import { apiRequest } from "@/lib/api";
import { resolveServerUrl } from "@/lib/server-url";
import { logoutWebengageUser } from "@/lib/webengage";

export const authClient = createAuthClient({
	baseURL: resolveServerUrl(),
	basePath: "/auth",
	fetchOptions: {
		credentials: "include",
	},
});

export const { signIn, signUp, useSession, getSession, changeEmail } = authClient;

export const PENDING_PHONE_PASSWORD_KEY = "sportsdey.pendingPhonePassword";
export const PHONE_SESSION_TOKEN_KEY = "sportsdey.phoneSessionToken";

export function storePhoneSessionToken(token: string) {
	sessionStorage.setItem(PHONE_SESSION_TOKEN_KEY, token);
}

export function readPhoneSessionToken(): string | null {
	return sessionStorage.getItem(PHONE_SESSION_TOKEN_KEY);
}

export function clearPhoneSessionToken() {
	sessionStorage.removeItem(PHONE_SESSION_TOKEN_KEY);
}

function bearerHeaders(token?: string | null): HeadersInit | undefined {
	if (!token) return undefined;
	return { Authorization: `Bearer ${token}` };
}

/** Start Google OAuth — explicit redirect (Better Auth fetch plugin can miss in some browsers). */
export async function signInWithGoogle(callbackURL: string): Promise<void> {
	const response = await fetch(`${resolveServerUrl()}/auth/sign-in/social`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ provider: "google", callbackURL }),
	});

	let data: { url?: string; message?: string; error?: string } | null = null;
	try {
		data = (await response.json()) as typeof data;
	} catch {
		// ignore parse errors
	}

	if (!response.ok) {
		throw new Error(
			data?.message ||
				data?.error ||
				"Failed to sign in with Google. Please try again.",
		);
	}

	if (data?.url) {
		window.location.assign(data.url);
		return;
	}

	throw new Error("Failed to sign in with Google. Please try again.");
}

export async function signOut(
	...args: Parameters<typeof authClient.signOut>
) {
	logoutWebengageUser();
	clearPhoneSessionToken();
	return authClient.signOut(...args);
}

export type PhoneAuthPurpose = "signup" | "login" | "reset";

export async function requestPhoneOtp(
	phoneNumber: string,
	purpose?: PhoneAuthPurpose,
) {
	return apiRequest<{ message: string }>("phone-auth/request-otp", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ phoneNumber, purpose }),
	});
}

export type PhoneOtpUser = {
	id: string;
	name: string;
	email: string;
	emailVerified?: boolean;
	image?: string | null;
	createdAt?: string;
	updatedAt?: string;
	mobileNumber: string | null;
	dob?: string | null;
	verificationStatus?: string;
	country?: string | null;
};

export type PhoneAuthSession = {
	id: string;
	token: string;
	userId: string;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
	ipAddress?: string | null;
	userAgent?: string | null;
};

export type PhoneAuthSuccess = {
	/** Better Auth OAuth-shaped session (carbon copy). */
	session: PhoneAuthSession;
	user: PhoneOtpUser;
	/** Alias of `session.token` for existing phone clients. */
	token: string;
	message?: string;
	expiresAt?: string;
	isFirstTimeSignIn?: boolean;
	needsProfileCompletion?: boolean;
};

/** Confirm session after phone verify/login (cookies and/or Bearer token). */
export async function getSessionAfterPhoneAuth(token?: string | null) {
	return authClient.getSession({
		fetchOptions: {
			headers: bearerHeaders(token),
		},
	});
}

export async function verifyPhoneOtp(
	phoneNumber: string,
	otp: string,
	purpose?: PhoneAuthPurpose,
) {
	const data = await apiRequest<PhoneAuthSuccess>("phone-auth/verify-otp", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({
			phoneNumber,
			otp,
			purpose,
		}),
	});
	if (data.token) storePhoneSessionToken(data.token);
	return data;
}

export async function loginWithPhone(phoneNumber: string, password: string) {
	const data = await apiRequest<PhoneAuthSuccess>("phone-auth/login", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({
			phoneNumber,
			password,
		}),
	});
	if (data.token) storePhoneSessionToken(data.token);
	return data;
}

export async function setPhonePassword(
	password: string,
	token?: string | null,
) {
	const sessionToken = token ?? readPhoneSessionToken();
	return apiRequest<{ message: string }>("phone-auth/set-password", {
		method: "POST",
		credentials: "include",
		headers: bearerHeaders(sessionToken),
		body: JSON.stringify({ password }),
	});
}
