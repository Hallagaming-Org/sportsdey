import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useState } from "react";
import { signIn } from "@/lib/auth/client";
import { buildPublicUrl } from "@/lib/public-url";
import { trackWebengageLoginInitiated } from "@/lib/webengage";
import z from "zod";

const signUpSearchSchema = z.object({
	returnTo: z.string().optional().catch(""),
	mode: z.enum(["login", "signup"]).optional().catch("signup"),
});

export const Route = createFileRoute("/auth/sign-up")({
	validateSearch: signUpSearchSchema,
	component: SignUpPage,
});

export default function SignUpPage() {
	const { returnTo } = Route.useSearch();
	const navigate = useNavigate();

	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const callbackURL = returnTo
		? buildPublicUrl(
				`/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
			)
		: buildPublicUrl("/auth/callback");

	const handleSocialSignUp = async (
		provider: "google" | "apple" | "facebook",
	) => {
		setIsLoading(true);
		setError("");
		trackWebengageLoginInitiated(provider);
		try {
			const result = await signIn.social({
				provider,
				callbackURL,
			});
			if (result?.error) {
				setError(
					result.error.message || `Failed to sign up with ${provider}`,
				);
			}
		} catch (err) {
			setError("Failed to sign up with " + provider);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-12">
			<div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
				<div className="mb-8 text-center">
					<h1 className="mb-2 font-bold text-2xl text-gray-900">
						Sign up to your account
					</h1>
					<p className="text-gray-500">Sign up for an account</p>
				</div>

				{error && (
					<div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 text-sm">
						{error}
					</div>
				)}

				<div className="space-y-3">
					<button
						type="button"
						onClick={() =>
							navigate({
								to: "/auth/phone-sign-in",
								search: { mode: "signup", returnTo },
							})
						}
						className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50"
					>
						<Phone className="h-5 w-5 text-gray-700" />
						<span className="font-medium text-gray-700">
							Sign up with phone number
						</span>
					</button>
					<button
						onClick={() => handleSocialSignUp("google")}
						disabled={isLoading}
						className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 disabled:opacity-50"
					>
						<svg className="h-5 w-5" viewBox="0 0 24 24">
							<path
								fill="#4285F4"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="#34A853"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="#FBBC05"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="#EA4335"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						<span className="font-medium text-gray-700">
							Continue with Google
						</span>
					</button>

					<button
						onClick={() => handleSocialSignUp("apple")}
						disabled={isLoading}
						className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 disabled:opacity-50"
					>
						<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
						</svg>
						<span className="font-medium text-gray-700">
							Continue with Apple
						</span>
					</button>

					<button
						onClick={() => handleSocialSignUp("facebook")}
						disabled={isLoading}
						className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 disabled:opacity-50"
					>
						<svg className="h-5 w-5" fill="#1877F2" viewBox="0 0 24 24">
							<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
						</svg>
						<span className="font-medium text-gray-700">
							Continue with Facebook
						</span>
					</button>
				</div>

				<p className="mt-6 text-center text-gray-500 text-sm">
					Already have an account?{" "}
					<Link
						to="/auth/sign-in"
						search={{ returnTo }}
						className="font-medium text-blue-600 hover:text-blue-700"
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
