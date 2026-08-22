import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient, setPhonePassword } from "@/lib/auth/client";

const resetPasswordSearchSchema = z.object({
	phone: z.string().optional().catch(""),
	token: z.string().optional().catch(""),
	error: z.string().optional().catch(""),
});

export const Route = createFileRoute("/auth/reset-password")({
	validateSearch: resetPasswordSearchSchema,
	component: ResetPasswordPage,
});

function getPasswordStrength(pass: string): {
	score: number;
	label: string;
	color: string;
} {
	if (!pass) return { score: 0, label: "", color: "bg-[#dbdbdb]" };
	let score = 0;
	if (pass.length >= 8) score++;
	if (/[0-9]/.test(pass)) score++;
	if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
	if (/[^A-Za-z0-9]/.test(pass)) score++;

	if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-500" };
	if (score === 2) return { score: 2, label: "Fair", color: "bg-yellow-500" };
	if (score === 3) return { score: 3, label: "Good", color: "bg-[#17b000]" };
	return { score: 4, label: "Strong", color: "bg-[#17b000]" };
}

function ResetPasswordPage() {
	const { token, error: searchError } = Route.useSearch();
	const navigate = useNavigate();

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(searchError || "");

	const strength = useMemo(
		() => getPasswordStrength(newPassword),
		[newPassword],
	);

	const isValid =
		newPassword.length >= 8 &&
		/\d/.test(newPassword) &&
		newPassword === confirmPassword;

	const handleUpdatePassword = async () => {
		if (!isValid) {
			if (newPassword.length < 8) {
				setError("Password must be at least 8 characters long.");
				return;
			}
			if (!/\d/.test(newPassword)) {
				setError("Password must include at least one number.");
				return;
			}
			if (newPassword !== confirmPassword) {
				setError("Passwords do not match.");
				return;
			}
			return;
		}

		setError("");
		setIsLoading(true);

		try {
			if (token) {
				const result = await authClient.resetPassword({
					newPassword,
					token,
				});
				if (result?.error) {
					setError(
						result.error.message ||
							"Failed to reset password. Please try again.",
					);
					return;
				}
			} else {
				await setPhonePassword(newPassword);
			}
			toast.success("Password updated successfully! Please log in.");
			navigate({
				to: "/auth/phone-sign-in",
				search: {
					mode: "login",
				},
			});
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to update password. Please try again.",
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
						Create New Password
					</h1>
					<p className="mt-2 font-medium text-[#6f7471] text-sm">
						Step 3 of 3
					</p>
				</div>

				<div className="flex flex-col gap-4">
					<div className="flex h-[80px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-colors focus-within:border-[#17b000]">
						<Lock className="mr-3 shrink-0 text-[#9a9d9a]" size={20} />
						<input
							type={showNewPassword ? "text" : "password"}
							value={newPassword}
							onChange={(event) => setNewPassword(event.target.value)}
							placeholder="New password"
							className="w-full bg-transparent text-[#0a0f0d] text-base outline-none placeholder:text-[#9a9d9a]"
						/>
						<button
							type="button"
							onClick={() => setShowNewPassword(!showNewPassword)}
							className="shrink-0 text-[#9a9d9a] focus:outline-none"
						>
							{showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
						</button>
					</div>

					<div className="flex h-[80px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-colors focus-within:border-[#17b000]">
						<Lock className="mr-3 shrink-0 text-[#9a9d9a]" size={20} />
						<input
							type={showConfirmPassword ? "text" : "password"}
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							placeholder="Confirm password"
							className="w-full bg-transparent text-[#0a0f0d] text-base outline-none placeholder:text-[#9a9d9a]"
						/>
						<button
							type="button"
							onClick={() => setShowConfirmPassword(!showConfirmPassword)}
							className="shrink-0 text-[#9a9d9a] focus:outline-none"
						>
							{showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
						</button>
					</div>

					{newPassword ? (
						<div className="flex flex-col gap-1.5 px-1">
							<div className="flex items-center justify-between text-xs">
								<span className="text-[#6f7471]">
									Password strength{" "}
									<span className="font-semibold text-[#0a0f0d]">
										{strength.label}
									</span>
								</span>
							</div>
							<div className="grid grid-cols-4 gap-2">
								{[1, 2, 3, 4].map((level) => (
									<div
										key={level}
										className={`h-1.5 rounded-full transition-all duration-300 ${
											level <= strength.score ? strength.color : "bg-[#dbdbdb]"
										}`}
									/>
								))}
							</div>
						</div>
					) : null}
				</div>

				{error ? (
					<div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-left text-red-700 text-sm">
						{error}
					</div>
				) : null}

				<button
					type="button"
					onClick={handleUpdatePassword}
					disabled={!isValid || isLoading}
					className="mt-8 w-full cursor-pointer rounded-2xl bg-[#17b000] py-[18px] font-semibold text-lg text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isLoading ? "Updating..." : "Update Password"}
				</button>

				<div className="mt-6 flex items-center justify-center gap-2 text-center text-[#6f7471] text-xs">
					<Lock className="h-3.5 w-3.5 shrink-0" />
					<span>Password must be at least 8 characters with a number.</span>
				</div>
			</div>
		</div>
	);
}
