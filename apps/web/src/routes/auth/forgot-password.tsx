import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { requestPhoneOtp } from "@/lib/auth/client";
import { Mail, Phone } from "lucide-react";
import z from "zod";

const forgotPasswordSearchSchema = z.object({
	phone: z.string().optional().catch(""),
	email: z.string().optional().catch(""),
});

export const Route = createFileRoute("/auth/forgot-password")({
	validateSearch: forgotPasswordSearchSchema,
	component: ForgotPasswordPage,
});

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

	const [identifier, setIdentifier] = useState(initialPhone || initialEmail || "");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const isPhone = /^[0-9+()\s-]+$/.test(identifier.trim()) && identifier.replace(/\D/g, "").length >= 10;
	const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
	const canContinue = isPhone || isEmail || identifier.trim().length >= 6;

	const handleContinue = async () => {
		if (!canContinue) return;

		setError("");
		setIsLoading(true);

		try {
			const cleanIdentifier = identifier.trim();
			const phoneCandidate = normalizePhoneNumber(cleanIdentifier);

			if (isPhone || phoneCandidate) {
				await requestPhoneOtp(phoneCandidate || cleanIdentifier);
				navigate({
					to: "/auth/otp",
					search: {
						phone: phoneCandidate || cleanIdentifier,
						flow: "reset-password",
					},
				});
			} else {
				// Email flow placeholder / direct to verification
				navigate({
					to: "/auth/otp",
					search: {
						phone: cleanIdentifier,
						flow: "reset-password",
					},
				});
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to send verification code. Please try again.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-[calc(100svh-60px)] items-start justify-center bg-white px-4 pt-20 pb-10 lg:min-h-[calc(100svh-80px)] lg:pt-24">
			<div className="w-full max-w-[530px]">
				<div className="mb-8 text-center">
					<h1 className="font-bold text-[32px] text-[#0a0f0d] leading-tight">
						Let's Recover Your Account
					</h1>
					<p className="mt-2 font-medium text-[#6f7471] text-sm">
						Step 1 of 3
					</p>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex h-[80px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 transition-colors focus-within:border-[#17b000] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
						{/* {isPhone ? (
							<Phone className="mr-3 shrink-0 text-[#9a9d9a]" size={20} />
						) 
						: (
							<Mail className="mr-3 shrink-0 text-[#9a9d9a]" size={20} />
						)
						} */}
						{
							<Phone className="mr-3 shrink-0 text-[#9a9d9a]" size={20} />
						}
						<input
							type="text"
							value={identifier}
							onChange={(event) => setIdentifier(event.target.value)}
							placeholder="Phone Number"
							className="w-full bg-transparent text-[#0a0f0d] text-base outline-none placeholder:text-[#9a9d9a]"
						/>
					</div>

					<p className="px-1 text-xs text-[#6f7471]">
						We have sent a 6-digit code to verify your identity.
					</p>
				</div>

				{error ? (
					<div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-left text-red-700 text-sm">
						{error}
					</div>
				) : null}

				<button
					type="button"
					onClick={handleContinue}
					disabled={!canContinue || isLoading}
					className="mt-8 w-full cursor-pointer rounded-2xl bg-[#17b000] py-[18px] font-semibold text-lg text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
				>
					{isLoading ? "Sending code..." : "Continue"}
				</button>
			</div>
		</div>
	);
}
