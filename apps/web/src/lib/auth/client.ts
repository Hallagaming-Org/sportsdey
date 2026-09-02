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

export async function verifyPhoneOtp(phoneNumber: string, otp: string) {
	return apiRequest<{
		message: string;
		expiresAt?: string;
		user: PhoneOtpUser;
		isFirstTimeSignIn?: boolean;
		needsProfileCompletion?: boolean;
	}>("phone-auth/verify-otp", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({
			phoneNumber,
			otp,
		}),
	});
}

export async function loginWithPhone(phoneNumber: string, password: string) {
	return apiRequest<{
		message: string;
		expiresAt?: string;
		user: PhoneOtpUser;
		isFirstTimeSignIn?: boolean;
		needsProfileCompletion?: boolean;
	}>("phone-auth/login", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({
			phoneNumber,
			password,
		}),
	});
}

export async function setPhonePassword(password: string) {
	return apiRequest<{ message: string }>("phone-auth/set-password", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ password }),
	});
}

export const PENDING_PHONE_PASSWORD_KEY = "sportsdey.pendingPhonePassword";
