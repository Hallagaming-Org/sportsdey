/** Shared password rules for reset and in-account change (stricter of signup vs reset). */
export const MIN_PASSWORD_LENGTH = 8;

export function getPasswordStrength(pass: string): {
	score: number;
	label: string;
	color: string;
} {
	if (!pass) return { score: 0, label: "", color: "bg-[#dbdbdb]" };
	let score = 0;
	if (pass.length >= MIN_PASSWORD_LENGTH) score++;
	if (/[0-9]/.test(pass)) score++;
	if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
	if (/[^A-Za-z0-9]/.test(pass)) score++;

	if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-500" };
	if (score === 2) return { score: 2, label: "Fair", color: "bg-yellow-500" };
	if (score === 3) return { score: 3, label: "Good", color: "bg-[#17b000]" };
	return { score: 4, label: "Strong", color: "bg-[#17b000]" };
}

export function validateNewPassword(
	newPassword: string,
	confirmPassword: string,
): string | null {
	if (newPassword.length < MIN_PASSWORD_LENGTH) {
		return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
	}
	if (!/\d/.test(newPassword)) {
		return "Password must include at least one number.";
	}
	if (newPassword !== confirmPassword) {
		return "Passwords do not match.";
	}
	return null;
}
