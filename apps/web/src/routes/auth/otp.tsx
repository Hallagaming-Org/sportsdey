import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import z from "zod";
import { storePendingReferralCode } from "@/lib/affnook";
import { authClient, verifyPhoneOtp } from "@/lib/auth/client";
import { needsPhoneProfileCompletion } from "@/lib/auth/phone-user";
import { loginWebengageUser } from "@/lib/webengage";

const otpSearchSchema = z.object({
	phone: z.string().optional().catch(""),
	referralCode: z.string().optional().catch(""),
});

export const Route = createFileRoute("/auth/otp")({
	validateSearch: otpSearchSchema,
	component: OtpPage,
});

function OtpPage() {
	const navigate = useNavigate();
	const { phone, referralCode } = Route.useSearch();
	const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
	const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const secondsLeft = 44;

	const canVerify = useMemo(
		() => otpDigits.every((digit) => digit.length === 1),
		[otpDigits],
	);

	const handleInput = (index: number, value: string) => {
		const cleanedValue = value.replace(/\D/g, "").slice(-1);
		const next = [...otpDigits];
		next[index] = cleanedValue;
		setOtpDigits(next);
		if (cleanedValue && index < next.length - 1) {
			inputsRef.current[index + 1]?.focus();
		}
	};

	const handleKeyDown = (
		index: number,
		event: KeyboardEvent<HTMLInputElement>,
	) => {
		if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
			inputsRef.current[index - 1]?.focus();
		}
	};

	const handleVerify = async () => {
		if (!canVerify) return;
		if (!phone) {
			setError("Phone number missing. Please start again.");
			navigate({ to: "/auth/phone-sign-in" });
			return;
		}

		setError("");
		setIsLoading(true);

		try {
			const otp = otpDigits.join("");
			const data = await verifyPhoneOtp(phone, otp);			
			await authClient.getSession();
			authClient.$store.notify("$sessionSignal");

			loginWebengageUser(data.user.id);

			const trimmedReferral = referralCode?.trim();
			if (trimmedReferral) {			
				storePendingReferralCode(trimmedReferral);
			}

			if (
				needsPhoneProfileCompletion({
					...data.user,
					isFirstTimeSignIn: data.isFirstTimeSignIn,
					needsProfileCompletion: data.needsProfileCompletion,
				})
			) {
				navigate({
					to: "/auth/complete-profile",
					search: {
						phone,
						referralCode: trimmedReferral || undefined,
					},
				});
				return;
			}

			navigate({ to: "/", search: { league: "sports", sports: "football" } });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Invalid OTP. Please try again.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-[calc(100svh-60px)] items-start justify-center bg-[#ebebeb] px-4 pt-16 pb-10 lg:min-h-[calc(100svh-80px)] lg:pt-20">
			<div className="w-full max-w-[620px] text-center">
				<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm">
					<Mail className="h-8 w-8 text-[#17b000]" />
				</div>
				<h1 className="mt-6 font-bold text-2xl text-[#0a0f0d]">
					Enter OTP Code
				</h1>
				<p className="mt-3 text-[#1f2522] text-base">
					A code has been sent to {phone || "+234 803 123 4567"}
				</p>

				<div className="mt-10 flex items-center justify-center gap-2 lg:gap-3">
					{otpDigits.map((digit, index) => (
						<input
							key={`otp-input-${index + 1}`}
							ref={(el) => {
								inputsRef.current[index] = el;
							}}
							type="text"
							inputMode="numeric"
							maxLength={1}
							value={digit}
							onChange={(event) => handleInput(index, event.target.value)}
							onKeyDown={(event) => handleKeyDown(index, event)}
							className="h-8 w-8 rounded-2xl border border-[#acacac] bg-[#efefef] text-center text-[#0f1513] text-base shadow-sm outline-none focus:border-[#17b000] lg:h-9 lg:w-9 lg:text-base"
						/>
					))}
				</div>

				{error ? (
					<div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-left text-red-700 text-sm">
						{error}
					</div>
				) : null}

				<button
					type="button"
					onClick={handleVerify}
					disabled={!canVerify || isLoading}
					className="mt-4 w-full rounded-2xl bg-[#17b000] py-1.5 font-medium text-sm text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isLoading ? "Verifying..." : "Verify"}
				</button>

				<div className="mx-auto mt-10 flex w-full max-w-[420px] items-center gap-3 text-[#2a302d] text-sm">
					<div className="h-px flex-1 bg-[#b7b7b7]" />
					<span>Resend code in 0:{String(secondsLeft).padStart(2, "0")}</span>
					<div className="h-px flex-1 bg-[#b7b7b7]" />
				</div>
			</div>
		</div>
	);
}
