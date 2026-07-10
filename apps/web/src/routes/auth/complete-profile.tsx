import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import z from "zod";
import { apiRequest } from "@/lib/api";
import { changeEmail, useSession } from "@/lib/auth/client";
import {
	loginWebengageUser,
	setWebengageUserAttributes,
	trackWebengageEvent,
} from "@/lib/webengage";

const profileSearchSchema = z.object({
	phone: z.string().optional().catch(""),
});

export const Route = createFileRoute("/auth/complete-profile")({
	validateSearch: profileSearchSchema,
	component: CompleteProfilePage,
});

function CompleteProfilePage() {
	const navigate = useNavigate();
	const { data: session, isPending: isSessionLoading } = useSession();
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [dob, setDob] = useState("");
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const referralId = "";

	useEffect(() => {
		if (session?.user?.id) {
			loginWebengageUser(session.user.id);
		}
		if (session?.user?.name) {
			setFullName(session.user.name);
		}
		if (session?.user?.email) {
			setEmail(session.user.email);
		}
	}, [session?.user?.email, session?.user?.id, session?.user?.name]);

	const isGeneratedLocalEmail = (value: string) =>
		/^phone_\d+@sportsdey\.local$/.test(value.trim());

	const canProceed =
		fullName.trim().length > 1 &&
		email.trim().length > 5 &&
		dob.trim().length > 0;

	const handleSubmit = async () => {
		if (!canProceed) return;

		setError("");
		setIsSubmitting(true);

		try {
			await apiRequest("user/", {
				method: "PATCH",
				credentials: "include",
				body: JSON.stringify({ name: fullName }),
			});

			const nameParts = fullName.trim().split(/\s+/);
			const firstName = nameParts[0] || "";
			const lastName = nameParts.slice(1).join(" ") || "";
			const userMobile =
				(session?.user as Record<string, unknown>)?.mobileNumber || "";
			setWebengageUserAttributes({
				we_first_name: firstName,
				we_last_name: lastName,
				we_email: email.trim(),
				we_phone: userMobile as string,
			});
			trackWebengageEvent("Profile Completed", {
				"First Name": firstName,
				"Last Name": lastName,
				Mobile: (userMobile as string) || "",
				Country: "",
				"Reference Id": referralId,
			});

			if (
				email.trim() &&
				email.trim() !== session?.user?.email &&
				!isGeneratedLocalEmail(email)
			) {
				const { error: emailError } = await changeEmail({
					newEmail: email.trim(),
					callbackURL: "/",
				});

				if (emailError) {
					throw new Error(emailError.message);
				}
			}

			navigate({ to: "/", search: {} as any });
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to update profile. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isSessionLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<p className="text-[#1e2421] text-xl">Loading your profile...</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-[calc(100svh-60px)] items-start justify-center bg-[#ebebeb] px-4 pt-14 pb-10 lg:min-h-[calc(100svh-80px)] lg:pt-20">
			<div className="w-full max-w-[530px]">
				<div className="mb-8 text-center">
					<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm">
						<User className="h-8 w-8 text-[#0d8f7c]" />
					</div>
					<h1 className="mt-4 font-bold text-2xl text-[#0a0f0d]">
						Complete Your Profile
					</h1>
					<p className="mt-2 text-[#202622] text-base">
						Tell us a bit about yourself
					</p>
				</div>

				<div className="space-y-5">
					<label className="flex items-center gap-3 rounded-3xl border border-[#bdbdbd] bg-[#efefef] px-2 py-1.5">
						<User className="h-6 w-6 text-[#8f8f8f]" />
						<input
							type="text"
							value={fullName}
							onChange={(event) => setFullName(event.target.value)}
							placeholder="Full name"
							className="w-full bg-transparent text-[#666] text-sm outline-none placeholder:text-[#8d8d8d]"
						/>
					</label>

					<label className="flex items-center gap-3 rounded-3xl border border-[#bdbdbd] bg-[#efefef] px-2 py-1.5">
						<Mail className="h-5 w-5 text-[#8f8f8f]" />
						<input
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="Email Address"
							className="w-full bg-transparent text-[#666] text-sm outline-none placeholder:text-[#8d8d8d]"
						/>
					</label>

					<label className="flex items-center gap-3 rounded-3xl border border-[#bdbdbd] bg-[#efefef] px-2 py-1.5">
						<CalendarDays className="h-5 w-5 text-[#8f8f8f]" />
						<input
							type="text"
							value={dob}
							onChange={(event) => setDob(event.target.value)}
							placeholder="DD/MM/YYYY"
							className="w-full bg-transparent text-[#666] text-sm outline-none placeholder:text-[#8d8d8d]"
						/>
						<ChevronDown className="h-5 w-5 text-[#b6b6b6]" />
					</label>
				</div>
				{error ? (
					<div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-left text-red-700 text-sm">
						{error}
					</div>
				) : null}

				<button
					type="button"
					onClick={handleSubmit}
					disabled={!canProceed || isSubmitting}
					className="mt-4 w-full rounded-2xl bg-[#17b000] py-1.5 font-medium text-sm text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isSubmitting ? "Saving..." : "Next"}
				</button>

				<div className="mt-6 text-center">
					<Link
						to="/"
						search={{} as any}
						className="text-[#1e2421] text-sm underline"
					>
						Skip for now
					</Link>
				</div>
			</div>
		</div>
	);
}
