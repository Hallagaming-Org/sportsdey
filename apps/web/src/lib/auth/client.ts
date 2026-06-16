import { createAuthClient } from "better-auth/react";
import { apiRequest } from "@/lib/api";

export const authClient = createAuthClient({
	baseURL: import.meta.env.DEV
		? "http://localhost:3000/"
		: import.meta.env.VITE_SERVER_URL ||
			import.meta.env.VITE_API_URL ||
			"https://staging-api.sportsdey.com/",
	basePath: "/auth",
	fetchOptions: {
		credentials: "include",
	},
});

export const { signIn, signOut, signUp, useSession, getSession, changeEmail } =
	authClient;

export async function requestPhoneOtp(phoneNumber: string) {
	return apiRequest<{ message: string }>("phone-auth/request-otp", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ phoneNumber }),
	});
}

export async function verifyPhoneOtp(phoneNumber: string, otp: string) {
	return apiRequest<{
		message: string;
		token: string;
		user: {
			id: string;
			name: string;
			email: string;
			mobileNumber: string | null;
		};
		isFirstTimeSignIn?: boolean;
	}>("phone-auth/verify-otp", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ phoneNumber, otp }),
	});
}
