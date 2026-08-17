<<<<<<< HEAD
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Phone } from "lucide-react";
import z from "zod";

const forgotPasswordSearchSchema = z.object({
	phone: z.string().optional().catch(""),
	email: z.string().optional().catch(""),
=======
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import z from "zod";
import { authClient } from "@/lib/auth/client";
import { buildPublicUrl } from "@/lib/public-url";

const forgotPasswordSearchSchema = z.object({
	returnTo: z.string().optional().catch(""),
>>>>>>> b438dbb (feat: add forgot password link and reset flow to login)
});

export const Route = createFileRoute("/auth/forgot-password")({
	validateSearch: forgotPasswordSearchSchema,
	component: ForgotPasswordPage,
});

<<<<<<< HEAD
const normalizePhoneNumber = (value: string) => {
	const digits = value.replace(/\D/g, "");
	if (!digits) return "";
	if (digits.startsWith("0") && digits.length === 11) {
		return digits;
	}
	if (digits.startsWith("234") && digits.length === 13) {
		return `+${digits}`;
	}
	if (digits.length === 10) {
		return `+234${digits}`;
	}
	return digits;
};

function ForgotPasswordPage() {
	const { phone: initialPhone, email: initialEmail } = Route.useSearch();
	const navigate = useNavigate();

	const [phoneNumber, setPhoneNumber] = useState(initialPhone || initialEmail || "");
	const [error, setError] = useState("");

	const canContinue = phoneNumber.replace(/\D/g, "").length >= 10 || phoneNumber.trim().length >= 6;

	const handleContinue = () => {
		if (!canContinue) return;

		const cleanPhone = phoneNumber.trim();
		const normalized = normalizePhoneNumber(cleanPhone) || cleanPhone;

		setError("");
		navigate({
			to: "/auth/reset-password",
			search: {
				phone: normalized,
			},
		});
	};

	return (
		<div className="flex min-h-[calc(100svh-60px)] items-start justify-center bg-white px-4 pt-20 pb-10 lg:min-h-[calc(100svh-80px)] lg:pt-24">
			<div className="w-full max-w-[530px]">
				<div className="mb-8 text-center">
					<h1 className="font-bold text-[32px] text-[#0a0f0d] leading-tight">
						Let's Recover Your Account
					</h1>
					<p className="mt-2 font-medium text-[#6f7471] text-sm">
						Step 1 of 2
					</p>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex h-[80px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 transition-colors focus-within:border-[#17b000] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
						<Phone className="mr-3 shrink-0 text-[#9a9d9a]" size={20} />
						<input
							type="tel"
							value={phoneNumber}
							onChange={(event) => setPhoneNumber(event.target.value)}
							placeholder="Phone Number"
							className="w-full bg-transparent text-[#0a0f0d] text-base outline-none placeholder:text-[#9a9d9a]"
						/>
					</div>
				</div>

				{error ? (
					<div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-left text-red-700 text-sm">
=======
function ForgotPasswordPage() {
	const { returnTo } = Route.useSearch();
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSent, setIsSent] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedEmail = email.trim();
		if (!trimmedEmail) {
			setError("Please enter your email address.");
			return;
		}

		setError("");
		setIsLoading(true);
		try {
			const result = await authClient.forgetPassword({
				email: trimmedEmail,
				redirectTo: buildPublicUrl("/auth/reset-password"),
			});
			if (result?.error) {
				setError(
					result.error.message || "Failed to send a reset link. Please try again.",
				);
				return;
			}
			setIsSent(true);
		} catch {
			setError("Failed to send a reset link. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-12">
			<div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
				<div className="mb-8 text-center">
					<h1 className="mb-2 font-bold text-2xl text-gray-900">
						Forgot password?
					</h1>
					<p className="text-[#0a0f0d] text-base font-medium">
						Enter the email on your account and we&apos;ll send a reset link.
					</p>
				</div>

				{error ? (
					<div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 text-sm">
>>>>>>> b438dbb (feat: add forgot password link and reset flow to login)
						{error}
					</div>
				) : null}

<<<<<<< HEAD
				<button
					type="button"
					onClick={handleContinue}
					disabled={!canContinue}
					className="mt-8 w-full cursor-pointer rounded-2xl bg-[#17b000] py-[18px] font-semibold text-lg text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
				>
					Continue
				</button>
=======
				{isSent ? (
					<div className="mb-6 rounded-lg bg-emerald-50 p-3 text-emerald-800 text-sm">
						If an account exists for that email, a reset link is on its way.
						You can also sign in with your phone number.
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						<input
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="Email address"
							autoComplete="email"
							className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-gray-700 text-sm outline-none placeholder:text-gray-400 focus:border-gray-400"
						/>
						<button
							type="submit"
							disabled={isLoading}
							className="w-full rounded-lg bg-[#17b000] py-3 font-medium text-sm text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isLoading ? "Sending..." : "Send reset link"}
						</button>
					</form>
				)}

				<p className="mt-6 text-center text-gray-500 text-sm">
					Prefer a one-time code?{" "}
					<Link
						to="/auth/phone-sign-in"
						className="font-medium text-blue-600 hover:text-blue-700"
					>
						Sign in with phone number
					</Link>
				</p>

				<p className="mt-4 text-center text-gray-500 text-sm">
					<Link
						to="/auth/sign-in"
						search={{ returnTo }}
						className="font-medium text-blue-600 hover:text-blue-700"
					>
						Back to log in
					</Link>
				</p>
>>>>>>> b438dbb (feat: add forgot password link and reset flow to login)
			</div>
		</div>
	);
}
