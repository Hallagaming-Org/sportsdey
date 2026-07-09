import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/auth/sign-in")({
	validateSearch: (search: Record<string, unknown>): { returnTo?: string } => {
		return {
			returnTo: search.returnTo as string | undefined,
		};
	},
	component: SignInPage,
});

export default function SignInPage() {
	const { returnTo } = Route.useSearch();

	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const webURL = import.meta.env.VITE_PUBLIC_URL;
	const callbackURL = returnTo
		? `${webURL}auth/callback?returnTo=${encodeURIComponent(returnTo)}`
		: `${webURL}auth/callback`;

	const handleSocialSignIn = async (provider: "google" | "facebook") => {
		setIsLoading(true);
		setError("");
		try {
			await signIn.social({
				provider,
				callbackURL,
			});
		} catch (err) {
			setError("Failed to sign in with " + provider);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-12">
			<div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
				<div className="mb-8 text-center">
					<h1 className="mb-2 font-bold text-2xl text-gray-900">
						Log in to your account
					</h1>
					<p className="text-gray-500">It&apos;s fun, easy, and enjoyable.</p>
				</div>

				{error && (
					<div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 text-sm">
						{error}
					</div>
				)}

				<div className="space-y-3">
					<button
						onClick={() => handleSocialSignIn("google")}
						disabled={isLoading}
						className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 disabled:opacity-50"
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

					{/*<button
						onClick={() => handleSocialSignIn("facebook")}
						disabled={isLoading}
						className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 disabled:opacity-50"
					>
						<svg className="h-5 w-5" fill="#1877F2" viewBox="0 0 24 24">
							<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
						</svg>
						<span className="font-medium text-gray-700">
							Continue with Facebook
						</span>
					</button>*/}
				</div>

				<p className="mt-6 text-center text-gray-500 text-sm">
					By continuing, you acknowledge that you understand and accept out{" "}
					<Link to="/terms" className="font-medium text-accent">
						Terms &amp; Conditions
					</Link>{" "}
					and{" "}
					<Link to="/privacy-policy" className="font-medium text-accent">
						Privacy policy
					</Link>
					.
				</p>
			</div>
		</div>
	);
}
