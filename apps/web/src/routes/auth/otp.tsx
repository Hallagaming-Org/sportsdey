import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import z from "zod";
import { storePendingReferralCode } from "@/lib/affnook";
import {
	authClient,
	PENDING_PHONE_PASSWORD_KEY,
	requestPhoneOtp,
	setPhonePassword,
	verifyPhoneOtp,
} from "@/lib/auth/client";
import { needsPhoneProfileCompletion } from "@/lib/auth/phone-user";
import {
	loginWebengageUser,
	setWebengageSdkUserProfile,
} from "@/lib/webengage";

const OTP_RESEND_COOLDOWN_SECONDS = 60;

const otpSearchSchema = z.object({
	phone: z.string().optional().catch(""),
	referralCode: z.string().optional().catch(""),
	flow: z.string().optional().catch(""),
});

export const Route = createFileRoute("/auth/otp")({
	validateSearch: otpSearchSchema,
	component: OtpPage,
});

function OtpPage() {
	const navigate = useNavigate();
	const { phone, referralCode, flow } = Route.useSearch();
	const isResetPasswordFlow =
		flow === "reset-password" || flow === "forgot-password";
	const isSignUpFlow = flow === "signup";
	const showStepLabel = isResetPasswordFlow || isSignUpFlow;
	const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
	const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(OTP_RESEND_COOLDOWN_SECONDS);

	const canVerify = useMemo(
		() => otpDigits.every((digit) => digit.length === 1),
		[otpDigits],
	);
	const canResend = secondsLeft <= 0 && !isResending;

	useEffect(() => {
		if (secondsLeft <= 0) return;
		const timer = window.setTimeout(() => {
			setSecondsLeft((prev) => prev - 1);
		}, 1000);
		return () => window.clearTimeout(timer);
	}, [secondsLeft]);

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

	const handleResend = async () => {
		if (!canResend) return;
		if (!phone) {
			setError("Phone number missing. Please start again.");
			navigate({
				to: isResetPasswordFlow
					? "/auth/forgot-password"
					: "/auth/phone-sign-in",
				search: isResetPasswordFlow
					? {}
					: { mode: isSignUpFlow ? "signup" : "login" },
			});
			return;
		}

		setError("");
		setIsResending(true);
		try {
			await requestPhoneOtp(phone);
			setSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
			setOtpDigits(["", "", "", "", "", ""]);
			inputsRef.current[0]?.focus();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to resend code. Please try again.",
			);
		} finally {
			setIsResending(false);
		}
	};

	const handleVerify = async () => {
		if (!canVerify) return;
		if (!phone) {
			setError("Phone number missing. Please start again.");
			navigate({
				to: isResetPasswordFlow
					? "/auth/forgot-password"
					: "/auth/phone-sign-in",
				search: isResetPasswordFlow
					? {}
					: { mode: isSignUpFlow ? "signup" : "login" },
			});
			return;
		}

		setError("");
		setIsLoading(true);

		try {
			const otp = otpDigits.join("");
			const data = await verifyPhoneOtp(phone, otp);
			const session = await authClient.getSession();
			if (!session?.data?.session) {
				throw new Error(
					"Sign-in succeeded but session was not established. Please try again.",
				);
			}
			authClient.$store.notify("$sessionSignal");

			loginWebengageUser(data.user.id);
			setWebengageSdkUserProfile({
				phone,
				firstName: data.user.name?.trim().split(/\s+/)[0],
			});

			if (isSignUpFlow) {
				const pendingPassword = sessionStorage.getItem(
					PENDING_PHONE_PASSWORD_KEY,
				);
				if (pendingPassword) {
					await setPhonePassword(pendingPassword);
					sessionStorage.removeItem(PENDING_PHONE_PASSWORD_KEY);
				}
			}

			const trimmedReferral = referralCode?.trim();
			if (trimmedReferral) {
				storePendingReferralCode(trimmedReferral);
			}

			if (isResetPasswordFlow) {
				navigate({
					to: "/auth/reset-password",
					search: {
						phone,
					},
				});
				return;
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
				{showStepLabel && (
					<p className="mt-4 font-medium text-[#6f7471] text-sm">Step 2 of 3</p>
				)}
				<h1 className="mt-4 font-bold text-2xl text-[#0a0f0d]">
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
					{canResend ? (
						<button
							type="button"
							onClick={handleResend}
							disabled={isResending}
							className="font-medium text-[#17b000] transition-opacity disabled:opacity-60"
						>
							{isResending ? "Sending..." : "Resend code"}
						</button>
					) : (
						<span>Resend code in 0:{String(secondsLeft).padStart(2, "0")}</span>
					)}
					<div className="h-px flex-1 bg-[#b7b7b7]" />
				</div>
			</div>
		</div>
	);
}
