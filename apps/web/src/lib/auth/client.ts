import { createAuthClient } from "better-auth/react";
import { apiRequest } from "@/lib/api";
import { resolveServerUrl } from "@/lib/server-url";

export const authClient = createAuthClient({
	baseURL: resolveServerUrl(),
	basePath: "/auth",
	fetchOptions: {
		credentials: "include",
	},
});

export const { signIn, signUp, useSession, getSession, changeEmail } = authClient;

export async function signOut(
	...args: Parameters<typeof authClient.signOut>
) {
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
