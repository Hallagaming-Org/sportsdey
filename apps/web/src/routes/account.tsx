import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Camera, Edit, Loader2, User } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { changeEmail, useSession } from "@/lib/auth/client";

export const Route = createFileRoute("/account")({
	component: AccountPage,
});

type UpdateUserResponse = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	country: string | null;
	mobileNumber: string | null;
	createdAt: string;
	updatedAt: string;
};

function AccountPage() {
	const {
		data: session,
		isPending: isSessionLoading,
		refetch: refetchSession,
	} = useSession();
	const [formState, setFormState] = useState({
		fullName: "",
		email: "",
		country: "",
		mobileNumbers: "",
		referralId: "",
	});
	const [isEditing, setIsEditing] = useState(false);
	const [isChangingEmail, setIsChangingEmail] = useState(false);
	const [newEmail, setNewEmail] = useState("");

	useEffect(() => {
		setFormState((prev) => ({
			...prev,
			fullName: session?.user?.name ?? "",
			email: session?.user?.email ?? "",
		}));
	}, [session?.user?.email, session?.user?.name]);

	const updateUserMutation = useMutation({
		mutationFn: (data: {
			name: string;
			country?: string;
			mobileNumber?: string;
		}) =>
			apiRequest<UpdateUserResponse>("user/", {
				method: "PATCH",
				credentials: "include",
				body: JSON.stringify(data),
			}),
		onSuccess: (data) => {
			setIsEditing(false);
			refetchSession();
			setFormState((prev) => ({
				...prev,
				fullName: data.name,
				country: data.country ?? "",
				mobileNumbers: data.mobileNumber ?? "",
			}));
			toast.success("Profile updated successfully");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			);
		},
	});

	const changeEmailMutation = useMutation({
		mutationFn: async (email: string) => {
			const { error } = await changeEmail({
				newEmail: email,
				callbackURL: "/account",
			});
			if (error) {
				throw new Error(error.message);
			}
		},
		onSuccess: () => {
			setIsChangingEmail(false);
			setNewEmail("");
			toast.success("Verification email sent to your new email address");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to send verification email",
			);
		},
	});

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		updateUserMutation.mutate({
			name: formState.fullName,
			country: formState.country || undefined,
			mobileNumber: formState.mobileNumbers || undefined,
		});
	};

	const updateField = (field: keyof typeof formState, value: string) => {
		setFormState((prev) => ({ ...prev, [field]: value }));
	};

	const inputIds = {
		fullName: "account-full-name",
		email: "account-email",
		country: "account-country",
		mobileNumbers: "account-mobile",
		referralId: "account-referral-id",
	};

	if (isSessionLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	const profileImage = session?.user?.image;
	const displayName = session?.user?.name || "User";
	const initials = displayName
		.split(" ")
		.map((n: string) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<div className="px-4 py-2 lg:container lg:mx-auto">
			<div className="no-scrollbar h-full space-y-6 overflow-y-auto pb-20">
				<div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-[#2F3033] dark:bg-[#0D0D0D]">
					{/* Header section */}
					<div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-[#2F3033]">
						<div>
							<h2 className="text-xl font-bold text-gray-900 dark:text-white">
								Account Information
							</h2>
							<p className="text-sm text-gray-500 dark:text-[#8C8F8F]">
								Edit your information details
							</p>
						</div>
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-[#1C1D1F]">
							<User className="h-5 w-5 text-gray-500 dark:text-[#8C8F8F]" />
						</div>
					</div>

					<div className="relative p-6 pb-8">
						{/* Edit profile link - top right */}
						<div className="absolute right-6 top-6 mb-4 flex justify-end">
							<button
								type="button"
								onClick={() => setIsEditing((prev) => !prev)}
								className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-primary dark:text-[#8C8F8F] dark:hover:text-white"
							>
								<Edit className="h-4 w-4" />
								<span>{isEditing ? "Cancel edit" : "Edit profile"}</span>
							</button>
						</div>

						{/* Profile photo - centered circle */}
						<div className="mb-10 mt-6 flex justify-center">
							<div className="relative">
								{profileImage ? (
									<img
										src={profileImage}
										alt={displayName}
										className="h-32 w-32 rounded-full border border-gray-200 object-cover dark:border-gray-700"
									/>
								) : (
									<div className="flex h-32 w-32 items-center justify-center rounded-full border border-gray-200 bg-[#F0F0F0] font-semibold text-3xl text-muted-foreground dark:border-[#2F3033] dark:bg-[#1C1D1F] dark:text-[#8C8F8F]">
										{initials}
									</div>
								)}
								{/* Camera icon overlay */}
								<div className="absolute right-1 bottom-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white shadow-md dark:border dark:border-[#2F3033] dark:bg-[#1C1D1F]">
									<Camera className="h-4 w-4 text-gray-600 dark:text-[#8C8F8F]" />
								</div>
							</div>
						</div>

						{/* Form fields */}
						<form onSubmit={handleSubmit}>
							<div className="space-y-4">
								{/* Full Name Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.fullName}
										className="shrink-0 font-medium text-sm text-gray-900 sm:w-48 dark:text-white"
									>
										Full name:
									</label>
									<Input
										id={inputIds.fullName}
										type="text"
										value={formState.fullName}
										onChange={(event) =>
											updateField("fullName", event.target.value)
										}
										disabled={!isEditing}
										className="flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 h-[42px] text-left shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Email Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.email}
										className="shrink-0 font-medium text-sm text-gray-900 sm:w-48 dark:text-white"
									>
										Email address:
									</label>
									<div className="flex flex-1 items-center gap-2">
										<Input
											id={inputIds.email}
											type="email"
											value={formState.email}
											disabled={true}
											className="flex-1 rounded-lg border-none bg-[#F4F4F4] py-2 px-4 h-[42px] text-left shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
										/>
										{/* <button
											type="button"
											onClick={() => setIsChangingEmail(true)}
											className="flex shrink-0 cursor-pointer items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-primary dark:text-[#8C8F8F] dark:hover:text-white"
										>
											<Mail className="h-4 w-4" />
											<span className="hidden sm:inline">Change</span>
										</button> */}
									</div>
								</div>

								{/* Country Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.country}
										className="shrink-0 font-medium text-sm text-gray-900 sm:w-48 dark:text-white"
									>
										Country:
									</label>
									<Input
										id={inputIds.country}
										type="text"
										value={formState.country}
										onChange={(event) =>
											updateField("country", event.target.value)
										}
										disabled={!isEditing}
										className="flex-1 rounded-lg border-none bg-[#F4F4F4] py-2 px-4 h-[42px] text-left shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Mobile Number Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.mobileNumbers}
										className="shrink-0 font-medium text-sm text-gray-900 sm:w-48 dark:text-white"
									>
										Mobile number:
									</label>
									<Input
										id={inputIds.mobileNumbers}
										type="tel"
										value={formState.mobileNumbers}
										onChange={(event) =>
											updateField("mobileNumbers", event.target.value)
										}
										disabled={!isEditing}
										className="flex-1 rounded-lg border-none bg-[#F4F4F4] py-2 px-4 h-[42px] text-center shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Referral ID Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.referralId}
										className="shrink-0 font-medium text-sm text-gray-900 sm:w-48 dark:text-white"
									>
										Referral ID:
									</label>
									<Input
										id={inputIds.referralId}
										type="text"
										value={formState.referralId}
										onChange={(event) =>
											updateField("referralId", event.target.value)
										}
										disabled={true}
										className="flex-1 rounded-lg border-none bg-[#F4F4F4] py-2 px-4 h-[42px] text-center shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>
							</div>

							{/* Save Changes button */}
							<div className="mt-8">
								<button
									type="submit"
									disabled={!isEditing || updateUserMutation.isPending}
									className="w-full cursor-pointer rounded-lg bg-[#EBEBEB] px-4 py-4 font-medium text-[#8C8F8F] text-sm transition-colors hover:bg-[#E0E0E0] disabled:cursor-default disabled:opacity-70 dark:bg-[#1C1D1F] dark:hover:bg-[#2A2B2A] [&:not(:disabled)]:bg-accent [&:not(:disabled)]:text-white [&:not(:disabled)]:dark:bg-accent [&:not(:disabled)]:dark:text-white"
								>
									{updateUserMutation.isPending ? "Saving..." : "Save Changes"}
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
			{/* Email Change Modal */}
			{isChangingEmail && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-[#202120]">
						<h3 className="mb-4 font-semibold text-lg text-primary">
							Change Email
						</h3>
						<p className="mb-4 text-muted-foreground text-sm">
							Enter your new email address. A verification link will be sent to
							your new email.
						</p>
						<div className="mb-4">
							<Input
								type="email"
								placeholder="New email address"
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
								disabled={changeEmailMutation.isPending}
							/>
						</div>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => {
									setIsChangingEmail(false);
									setNewEmail("");
								}}
								disabled={changeEmailMutation.isPending}
								className="flex-1 cursor-pointer rounded-lg bg-[#EBEBEB] px-4 py-2.5 font-medium text-primary text-sm transition-colors hover:bg-[#E0E0E0] disabled:cursor-default disabled:opacity-70 dark:bg-[#333] dark:hover:bg-[#3a3a3a]"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									if (newEmail && newEmail !== session?.user?.email) {
										changeEmailMutation.mutate(newEmail);
									} else {
										toast.error("Please enter a different email address");
									}
								}}
								disabled={!newEmail || changeEmailMutation.isPending}
								className="flex-1 cursor-pointer rounded-lg bg-accent px-4 py-2.5 font-medium text-sm text-white transition-colors hover:bg-accent/90 disabled:cursor-default disabled:opacity-70"
							>
								{changeEmailMutation.isPending
									? "Sending..."
									: "Send Verification"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
