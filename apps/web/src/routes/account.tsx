import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Camera, Edit, Loader2, User } from "lucide-react";
import {
	type ChangeEvent,
	type FormEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { DobPicker } from "@/components/dob-picker";
import { Input } from "@/components/ui/input";
import { syncAffnookRegistrationReferral } from "@/lib/affnook";
import { apiRequest, apiUploadFile } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { isPhonePlaceholderEmail } from "@/lib/auth/phone-user";
import {
	loginWebengageUser,
	setWebengageSdkUserProfile,
	trackWebengageEvent,
} from "@/lib/webengage";

export const Route = createFileRoute("/account")({
	component: AccountPage,
});

const PROFILE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_ADMIN_EMAIL = "support@sportsdey.com";
const PROFILE_EDIT_LOCKED_MESSAGE = `You've already updated your profile. Contact admin at ${PROFILE_ADMIN_EMAIL} if you need any further changes.`;

function dobToDisplay(value: string | null | undefined): string {
	if (!value) return "";
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
	return value;
}

type UserProfile = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	country: string | null;
	mobileNumber: string | null;
	dob: string | null;
	createdAt: string;
	updatedAt: string;
	canEditProfile?: boolean;
};

function AccountPage() {
	const {
		data: session,
		isPending: isSessionLoading,
		refetch: refetchSession,
	} = useSession();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [formState, setFormState] = useState({
		fullName: "",
		email: "",
		dob: "",
		country: "",
		mobileNumbers: "",
		referralCode: "",
		referralId: "",
	});
	const [isEditing, setIsEditing] = useState(false);
	const [showEditLocked, setShowEditLocked] = useState(false);
	const [previewImage, setPreviewImage] = useState<string | null>(null);

	const {
		data: profile,
		isPending: isProfileLoading,
		refetch: refetchProfile,
	} = useQuery({
		queryKey: ["account-profile", session?.user?.id],
		enabled: Boolean(session?.user?.id),
		queryFn: () => apiRequest<UserProfile>("user", { credentials: "include" }),
	});

	useEffect(() => {
		if (session?.user?.id) {
			loginWebengageUser(session.user.id);
		}
	}, [session?.user?.id]);

	useEffect(() => {
		if (!profile) return;
		setFormState((prev) => ({
			...prev,
			fullName: profile.name ?? "",
			email: profile.email ?? "",
			dob: dobToDisplay(profile.dob),
			country: profile.country ?? "",
			mobileNumbers: profile.mobileNumber ?? "",
		}));
		setPreviewImage(null);
		const nameParts = (profile.name ?? "").trim().split(/\s+/);
		setWebengageSdkUserProfile({
			email: profile.email,
			firstName: nameParts[0] || "",
			lastName: nameParts.slice(1).join(" ") || "",
			phone: profile.mobileNumber,
			dateOfBirth: profile.dob,
		});
	}, [profile]);

	const updateUserMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			email?: string;
			dob?: string;
			country?: string;
			mobileNumber?: string;
			referralCode?: string;
		}) => {
			const referral = data.referralCode?.trim();

			const payload: Record<string, string | boolean> = {
				name: data.name,
				accountEdit: true,
			};
			const nextEmail = data.email?.trim();
			if (nextEmail && !isPhonePlaceholderEmail(nextEmail)) {
				payload.email = nextEmail;
			}
			if (data.dob?.trim()) {
				payload.dob = data.dob.trim();
			}
			if (data.country?.trim()) {
				payload.country = data.country.trim();
			}
			if (data.mobileNumber?.trim()) {
				payload.mobileNumber = data.mobileNumber.trim();
			}

			// Profile first — Affnook only after name/details are saved.
			const user = await apiRequest<UserProfile>("user", {
				method: "PATCH",
				credentials: "include",
				body: JSON.stringify(payload),
			});

			let affnookMessage: string | undefined;
			if (referral) {
				const affnook = await syncAffnookRegistrationReferral({
					promocode: referral,
					country: data.country,
				});
				affnookMessage = affnook.message;
			}

			return {
				user,
				referralSynced: Boolean(referral),
				affnookMessage,
			};
		},
		onSuccess: ({ user, referralSynced, affnookMessage }) => {
			setIsEditing(false);
			refetchSession();
			refetchProfile();
			setFormState((prev) => ({
				...prev,
				fullName: user.name,
				email: user.email,
				dob: dobToDisplay(user.dob),
				country: user.country ?? "",
				mobileNumbers: user.mobileNumber ?? "",
				referralId: referralSynced
					? prev.referralCode.trim() || prev.referralId
					: prev.referralId,
				referralCode: "",
			}));
			const nameParts = user.name.trim().split(/\s+/);
			const firstName = nameParts[0] || "";
			const lastName = nameParts.slice(1).join(" ") || "";
			setWebengageSdkUserProfile({
				email: user.email,
				firstName,
				lastName,
				phone: user.mobileNumber,
				dateOfBirth: user.dob,
			});
			trackWebengageEvent("Profile Completed", {
				userId: session?.user?.id ?? "",
				"First Name": firstName,
				"Last Name": lastName,
				Mobile: user.mobileNumber ?? "",
				Country: user.country ?? formState.country,
				"Reference Id": formState.referralCode || formState.referralId || "",
			});
			if (referralSynced) {
				if (affnookMessage) {
					toast.success(affnookMessage);
				} else {
					toast.error("Referral code could not be synced, but profile updated");
				}
			} else {
				toast.success("Profile updated successfully");
			}
		},
		onError: (error) => {
			const message =
				error instanceof Error ? error.message : "Failed to update profile";
			if (message.includes("already updated your profile")) {
				setIsEditing(false);
				setShowEditLocked(true);
			}
			toast.error(message);
		},
	});

	const uploadAvatarMutation = useMutation({
		mutationFn: async (file: File) => {
			if (!file.type.startsWith("image/")) {
				throw new Error("Please choose an image file");
			}
			if (file.size > PROFILE_IMAGE_MAX_BYTES) {
				throw new Error("Image must be 5MB or smaller");
			}

			const uploaded = await apiUploadFile({
				endpoint: "files/upload",
				file,
				fields: {
					purpose: "profile_pic",
					fileName: "profile-picture",
				},
			});

			const currentName =
				formState.fullName.trim() || profile?.name || session?.user?.name;
			if (!currentName) {
				throw new Error("Unable to update profile picture without a name");
			}

			return apiRequest<UserProfile>("user", {
				method: "PATCH",
				credentials: "include",
				body: JSON.stringify({
					name: currentName,
					image: uploaded.url,
				}),
			});
		},
		onSuccess: (user) => {
			setPreviewImage(null);
			refetchSession();
			refetchProfile();
			toast.success("Profile picture updated");
			if (user.image) {
				setPreviewImage(user.image);
			}
		},
		onError: (error) => {
			setPreviewImage(null);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update profile picture",
			);
		},
	});

	const handleAvatarClick = () => {
		if (uploadAvatarMutation.isPending) return;
		fileInputRef.current?.click();
	};

	const handleAvatarSelected = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		const objectUrl = URL.createObjectURL(file);
		setPreviewImage(objectUrl);
		uploadAvatarMutation.mutate(file, {
			onSettled: () => {
				URL.revokeObjectURL(objectUrl);
			},
		});
	};

	const canEditProfile = profile?.canEditProfile !== false;

	const promptContactAdmin = () => {
		setIsEditing(false);
		setShowEditLocked(true);
		toast.error(PROFILE_EDIT_LOCKED_MESSAGE);
	};

	const handleToggleEdit = () => {
		if (isEditing) {
			setIsEditing(false);
			return;
		}
		if (!canEditProfile) {
			promptContactAdmin();
			return;
		}
		setShowEditLocked(false);
		setIsEditing(true);
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canEditProfile) {
			promptContactAdmin();
			return;
		}
		updateUserMutation.mutate({
			name: formState.fullName,
			email: formState.email.trim() || undefined,
			dob: formState.dob.trim() || undefined,
			country: formState.country,
			mobileNumber: formState.mobileNumbers.trim() || undefined,
			referralCode: formState.referralCode || undefined,
		});
	};

	const updateField = (field: keyof typeof formState, value: string) => {
		setFormState((prev) => ({ ...prev, [field]: value }));
	};

	const inputIds = {
		fullName: "account-full-name",
		email: "account-email",
		dob: "account-dob",
		country: "account-country",
		mobileNumbers: "account-mobile",
		referralCode: "account-referral-code",
		referralId: "account-referral-id",
	};

	if (isSessionLoading || (session?.user && isProfileLoading)) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	const profileImage =
		previewImage || profile?.image || session.user.image || null;
	const displayName = profile?.name || session.user.name || "User";
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
					<div className="flex items-center justify-between border-gray-100 border-b p-6 dark:border-[#2F3033]">
						<div>
							<h2 className="font-bold text-gray-900 text-xl dark:text-white">
								Account Information
							</h2>
							<p className="text-gray-500 text-sm dark:text-[#8C8F8F]">
								{canEditProfile
									? "You can edit your profile once. Further changes go through admin."
									: "Profile edits are locked. Contact admin for changes."}
							</p>
						</div>
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-[#1C1D1F]">
							<User className="h-5 w-5 text-gray-500 dark:text-[#8C8F8F]" />
						</div>
					</div>

					<div className="relative p-6 pb-8">
						{/* Edit profile link - top right */}
						<div className="absolute top-6 right-6 mb-4 flex justify-end">
							<button
								type="button"
								onClick={handleToggleEdit}
								className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-primary dark:text-[#8C8F8F] dark:hover:text-white"
							>
								<Edit className="h-4 w-4" />
								<span>{isEditing ? "Cancel edit" : "Edit profile"}</span>
							</button>
						</div>

						{/* Profile photo - centered circle */}
						<div className="mt-6 mb-3 flex justify-center">
							<input
								ref={fileInputRef}
								type="file"
								accept={PROFILE_IMAGE_ACCEPT}
								className="sr-only"
								onChange={handleAvatarSelected}
							/>
							<button
								type="button"
								onClick={handleAvatarClick}
								disabled={uploadAvatarMutation.isPending || !isEditing}
								aria-label="Update profile picture"
								className="relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait"
							>
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
								<div className="absolute right-1 bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md dark:border dark:border-[#2F3033] dark:bg-[#1C1D1F]">
									{uploadAvatarMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin text-gray-600 dark:text-[#8C8F8F]" />
									) : (
										<Camera className="h-4 w-4 text-gray-600 dark:text-[#8C8F8F]" />
									)}
								</div>
							</button>
						</div>
						<div className="mb-10 flex justify-center">
							<p className="text-[10px] text-gray-500 md:text-sm dark:text-[#8C8F8F]">
								{displayName}
							</p>
						</div>

						{showEditLocked && (
							<div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
								<p>
									You've already updated your profile. Contact admin via email
									if you want any further changes:{" "}
									<a
										href={`mailto:${PROFILE_ADMIN_EMAIL}`}
										className="font-medium underline underline-offset-2"
									>
										{PROFILE_ADMIN_EMAIL}
									</a>
								</p>
							</div>
						)}

						{/* Form fields */}
						<form onSubmit={handleSubmit}>
							<div className="space-y-4">
								{/* Full Name Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.fullName}
										className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
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
										className="h-[42px] flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 text-left shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Email Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.email}
										className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
									>
										Email address:
									</label>
									<Input
										id={inputIds.email}
										type="email"
										value={formState.email}
										onChange={(event) =>
											updateField("email", event.target.value)
										}
										disabled={!isEditing}
										className="h-[42px] flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 text-left shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Date of birth */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.dob}
										className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
									>
										Date of birth:
									</label>
									<DobPicker
										id={inputIds.dob}
										value={formState.dob}
										onChange={(next) => updateField("dob", next)}
										disabled={!isEditing}
										placeholder="Select date of birth"
										className="flex-1"
										triggerClassName="h-[42px] rounded-lg border-none bg-[#F4F4F4] px-4 py-2 text-sm shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Country Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.country}
										className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
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
										className="h-[42px] flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 text-left shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Mobile Number Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.mobileNumbers}
										className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
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
										className="h-[42px] flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Referral Code Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.referralCode}
										className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
									>
										Referral code:
									</label>
									<Input
										id={inputIds.referralCode}
										type="text"
										value={formState.referralCode}
										onChange={(event) =>
											updateField("referralCode", event.target.value)
										}
										disabled={!isEditing}
										placeholder="Enter referral code"
										className="h-[42px] flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
									/>
								</div>

								{/* Referral ID Field */}
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<label
										htmlFor={inputIds.referralId}
										className="shrink-0 font-medium text-gray-900 text-sm sm:w-48 dark:text-white"
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
										className="h-[42px] flex-1 rounded-lg border-none bg-[#F4F4F4] px-4 py-2 text-center shadow-none disabled:opacity-100 dark:bg-[#1C1D1F] dark:text-[#8C8F8F]"
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
		</div>
	);
}
