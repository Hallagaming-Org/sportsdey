import { AlertTriangle, Edit, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { getPasswordStrength, validateNewPassword } from "@/lib/auth/password";

const SUPPORT_CHAT_URL =
	"https://tawk.to/chat/69a13f9e865cc31c343af2ac/1jieu113b";

const fieldClassName =
	"h-[42px] flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 text-left shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]";

function mapChangePasswordError(message: string | undefined): string {
	const text = (message ?? "").toLowerCase();
	if (text.includes("invalid password") || text.includes("incorrect")) {
		return "Current password is incorrect.";
	}
	if (
		text.includes("credential") ||
		text.includes("not found") ||
		text.includes("no password")
	) {
		return "This account doesn't have a login password. Use Forgot password on the sign-in page, or contact support.";
	}
	if (text.includes("too short")) {
		return "Password must be at least 8 characters long.";
	}
	return message?.trim() || "Failed to change password. Please try again.";
}

export function AccountSecurityPanel() {
	const [isEditing, setIsEditing] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const strength = useMemo(
		() => getPasswordStrength(newPassword),
		[newPassword],
	);

	const resetForm = () => {
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
		setShowCurrent(false);
		setShowNew(false);
		setShowConfirm(false);
		setError("");
	};

	const handleToggleEdit = () => {
		if (isEditing) {
			resetForm();
			setIsEditing(false);
			return;
		}
		setError("");
		setIsEditing(true);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!isEditing || isSubmitting) return;

		if (!currentPassword) {
			setError("Enter your current password to continue.");
			return;
		}

		const validationError = validateNewPassword(newPassword, confirmPassword);
		if (validationError) {
			setError(validationError);
			return;
		}

		if (currentPassword === newPassword) {
			setError("New password must be different from your current password.");
			return;
		}

		setError("");
		setIsSubmitting(true);
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			});
			if (result.error) {
				setError(mapChangePasswordError(result.error.message));
				return;
			}
			toast.success(
				"Login password updated. Other devices have been signed out.",
			);
			resetForm();
			setIsEditing(false);
		} catch (err) {
			setError(
				mapChangePasswordError(err instanceof Error ? err.message : undefined),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="p-6 pb-8">
			<div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
				<p>
					Please do not share your security access with anyone you do not trust
					or know.
				</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<label
						htmlFor={
							isEditing ? "account-current-password" : "account-login-password"
						}
						className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
					>
						Change Login Password:
					</label>
					<div className="flex min-w-0 flex-1 items-center gap-2">
						{isEditing ? null : (
							<Input
								id="account-login-password"
								type="password"
								value="••••••••"
								readOnly
								disabled
								className={fieldClassName}
							/>
						)}
						<button
							type="button"
							onClick={handleToggleEdit}
							className="flex shrink-0 cursor-pointer items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-primary dark:text-[#8C8F8F] dark:hover:text-white"
						>
							<Edit className="h-4 w-4" />
							<span>{isEditing ? "Cancel" : "Change"}</span>
						</button>
					</div>
				</div>

				{isEditing ? (
					<div className="space-y-4 sm:pl-48">
						<div>
							<label
								htmlFor="account-current-password"
								className="mb-1.5 block font-medium text-gray-900 text-sm dark:text-white"
							>
								Current password
							</label>
							<div className="relative">
								<Input
									id="account-current-password"
									type={showCurrent ? "text" : "password"}
									value={currentPassword}
									onChange={(event) => setCurrentPassword(event.target.value)}
									autoComplete="current-password"
									className={`${fieldClassName} pr-11`}
								/>
								<button
									type="button"
									onClick={() => setShowCurrent((open) => !open)}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-[#8C8F8F]"
									aria-label={
										showCurrent
											? "Hide current password"
											: "Show current password"
									}
								>
									{showCurrent ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						<div>
							<label
								htmlFor="account-new-password"
								className="mb-1.5 block font-medium text-gray-900 text-sm dark:text-white"
							>
								New password
							</label>
							<div className="relative">
								<Input
									id="account-new-password"
									type={showNew ? "text" : "password"}
									value={newPassword}
									onChange={(event) => setNewPassword(event.target.value)}
									autoComplete="new-password"
									className={`${fieldClassName} pr-11`}
								/>
								<button
									type="button"
									onClick={() => setShowNew((open) => !open)}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-[#8C8F8F]"
									aria-label={
										showNew ? "Hide new password" : "Show new password"
									}
								>
									{showNew ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						<div>
							<label
								htmlFor="account-confirm-password"
								className="mb-1.5 block font-medium text-gray-900 text-sm dark:text-white"
							>
								Confirm new password
							</label>
							<div className="relative">
								<Input
									id="account-confirm-password"
									type={showConfirm ? "text" : "password"}
									value={confirmPassword}
									onChange={(event) => setConfirmPassword(event.target.value)}
									autoComplete="new-password"
									className={`${fieldClassName} pr-11`}
								/>
								<button
									type="button"
									onClick={() => setShowConfirm((open) => !open)}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-[#8C8F8F]"
									aria-label={
										showConfirm
											? "Hide confirm password"
											: "Show confirm password"
									}
								>
									{showConfirm ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{newPassword ? (
							<div className="flex flex-col gap-1.5">
								<div className="text-gray-500 text-xs dark:text-[#8C8F8F]">
									Password strength{" "}
									<span className="font-semibold text-gray-900 dark:text-white">
										{strength.label}
									</span>
								</div>
								<div className="grid grid-cols-4 gap-2">
									{[1, 2, 3, 4].map((level) => (
										<div
											key={level}
											className={`h-1.5 rounded-full transition-all duration-300 ${
												level <= strength.score
													? strength.color
													: "bg-gray-200 dark:bg-[#2F3033]"
											}`}
										/>
									))}
								</div>
								<p className="flex items-center gap-1.5 text-[#8C8F8F] text-xs">
									<Lock className="h-3 w-3 shrink-0" />
									At least 8 characters with a number.
								</p>
							</div>
						) : null}

						{error ? (
							<div
								role="alert"
								className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
							>
								{error}
							</div>
						) : null}

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full cursor-pointer rounded-lg bg-accent px-4 py-4 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
						>
							{isSubmitting ? (
								<span className="inline-flex items-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									Updating...
								</span>
							) : (
								"Update password"
							)}
						</button>
					</div>
				) : null}
			</form>

			<div className="mt-10">
				<p className="mb-3 text-center text-gray-500 text-sm dark:text-[#8C8F8F]">
					If you are having trouble resetting any of your details, please
					contact our support team.
				</p>
				<button
					type="button"
					onClick={() => window.open(SUPPORT_CHAT_URL, "_blank")}
					className="w-full cursor-pointer rounded-lg bg-accent px-4 py-4 font-medium text-sm text-white transition-opacity hover:opacity-90"
				>
					Contact support team
				</button>
			</div>
		</div>
	);
}
