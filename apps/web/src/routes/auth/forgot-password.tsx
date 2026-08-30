import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useState } from "react";
import z from "zod";
import { requestPhoneOtp } from "@/lib/auth/client";

const forgotPasswordSearchSchema = z.object({
	phone: z.string().optional().catch(""),
	email: z.string().optional().catch(""),
	returnTo: z.string().optional().catch(""),
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

	const [phoneNumber, setPhoneNumber] = useState(
		initialPhone || initialEmail || "",
	);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const canContinue =
		phoneNumber.replace(/\D/g, "").length >= 10 ||
		phoneNumber.trim().length >= 6;

	const handleContinue = async () => {
		if (!canContinue) return;

		const cleanPhone = phoneNumber.trim();
		const normalized = normalizePhoneNumber(cleanPhone) || cleanPhone;

		setError("");
		setIsLoading(true);
		try {
			await requestPhoneOtp(normalized);
			navigate({
				to: "/auth/otp",
				search: {
					phone: normalized,
					flow: "forgot-password",
				},
			});
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to send OTP. Please try again.",
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
					<div className="flex h-[80px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-colors focus-within:border-[#17b000]">
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
						{error}
					</div>
				) : null}

				<button
					type="button"
					onClick={handleContinue}
					disabled={!canContinue || isLoading}
					className="mt-8 w-full cursor-pointer rounded-2xl bg-[#17b000] py-[18px] font-semibold text-lg text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isLoading ? "Sending OTP..." : "Continue"}
				</button>
			</div>
		</div>
	);
}
