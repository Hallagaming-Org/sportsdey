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

export async function verifyPhoneOtp(phoneNumber: string, otp: string) {
	const data = await apiRequest<{
		message: string;
		/** Raw session token used as Authorization Bearer (server re-signs when needed). */
		token: string;
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

	if (data.token) {
		storeSessionToken(data.token);
	}

	return data;
}
