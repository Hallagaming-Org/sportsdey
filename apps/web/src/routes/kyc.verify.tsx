import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Loader2,
	RefreshCw,
	Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	KycHeader,
	KycInputField,
	KycSelectField,
	KycShell,
	KycUploadBox,
} from "@/components/kyc";
import { useSession } from "@/lib/auth/client";
import {
	getKycStatus,
	type IdentificationType,
	type KycInfo,
	submitKyc,
} from "@/lib/kyc";

const IDENTIFICATION_OPTIONS = [
	{ value: "nin", label: "National ID (NIN)" },
	{ value: "drivers_license", label: "Driver's License" },
	{ value: "passport", label: "International Passport" },
	{ value: "voters_card", label: "Voter's Card" },
];

export const Route = createFileRoute("/kyc/verify")({
	loader: async (): Promise<KycInfo | null> => {
		try {
			return await getKycStatus();
		} catch {
			return null;
		}
	},
	component: KycVerifyPage,
});

function KycStatusDisplay({
	status,
	submittedAt,
	rejectionReason,
	showBackLink = false,
}: {
	status: string;
	submittedAt?: string;
	rejectionReason?: string | null;
	showBackLink?: boolean;
}) {
	const isApproved = status === "approved";
	const isPending = status === "pending_review";
	const isRejected = status === "rejected";

	const config = isApproved
		? {
				title: "Identity Verified",
				description:
					"Your identity has been successfully verified. You now have full access to all platform features.",
				iconBg: "bg-[#14804A]",
				pingBg: "bg-[#CCF3DD]",
				textColor: "text-[#14804A]",
				icon: "✓",
			}
		: isPending
			? {
					title: "Under Review",
					description:
						"Your documents are being reviewed. This usually takes 1-2 business days.",
					iconBg: "bg-[#B26A00]",
					pingBg: "bg-[#F2CF93]",
					textColor: "text-[#B26A00]",
					icon: "",
				}
			: {
					title: "Verification Failed",
					description:
						rejectionReason ||
						"We couldn't verify your documents. Please review the requirements and try again.",
					iconBg: "bg-[#D13030]",
					pingBg: "bg-[#FADBD8]",
					textColor: "text-[#D13030]",
					icon: "×",
				};

	const date = submittedAt
		? new Date(submittedAt).toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
			})
		: null;

	return (
		<div className="mx-auto max-w-md rounded-2xl border border-transparent bg-white p-8 text-center shadow-sm dark:border-[#1B2722] dark:bg-[#000606]">
			<div className="mb-6 flex justify-center">
				{isApproved && (
					<div className="relative flex h-24 w-24 items-center justify-center">
						<div
							className={`absolute h-24 w-24 animate-ping rounded-full ${config.pingBg}`}
						/>
						<div
							className={`relative flex h-20 w-20 items-center justify-center rounded-full ${config.iconBg} text-4xl text-white`}
						>
							{config.icon}
						</div>
					</div>
				)}
				{isRejected && (
					<div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-[#D13030] text-4xl text-white">
						{config.icon}
					</div>
				)}
				{isPending && (
					<div className="h-20 w-20 animate-spin rounded-full border-4 border-[#F2CF93] border-t-[#B26A00]" />
				)}
			</div>

			<h1 className={`font-semibold text-3xl ${config.textColor}`}>
				{config.title}
			</h1>
			<p className="mt-3 text-[#6E6E6E] text-sm">{config.description}</p>
			{date && (
				<p className="mt-2 text-[#B26A00] text-xs">Submitted on {date}</p>
			)}

			{isApproved && (
				<div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#CCF3DD] px-4 py-2 text-[#14804A] text-sm dark:bg-[#14804A]/20">
					<Shield className="h-4 w-4" />
					<span className="font-medium">KYC Completed</span>
				</div>
			)}

			{showBackLink && (
				<div className="mt-8 flex justify-center">
					<Link
						to="/kyc"
						className="flex items-center gap-2 rounded-lg bg-[#F0F0F0] px-5 py-2.5 font-medium text-primary text-sm"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Status
					</Link>
				</div>
			)}
		</div>
	);
}

function KycForm({
	fullName,
	setFullName,
	identificationType,
	setIdentificationType,
	frontDocument,
	setFrontDocument,
	backDocument,
	setBackDocument,
	isSubmitting,
	error,
	handleSubmit,
}: {
	fullName: string;
	setFullName: (v: string) => void;
	identificationType: string;
	setIdentificationType: (v: string) => void;
	frontDocument: File | null;
	setFrontDocument: (v: File | null) => void;
	backDocument: File | null;
	setBackDocument: (v: File | null) => void;
	isSubmitting: boolean;
	error: string;
	handleSubmit: () => void;
}) {
	return (
		<div className="rounded-2xl border border-transparent bg-white p-6 shadow-sm sm:p-8 dark:border-[#1B2722] dark:bg-[#000606]">
			<div className="mb-6 flex items-center gap-3">
				<div>
					<h2 className="font-semibold text-primary text-xl dark:text-white">
						Verify Your Identity
					</h2>
					<p className="text-[#8C8C8C] text-sm">
						Complete the steps below to get verified
					</p>
				</div>
			</div>

			{error && (
				<div className="mb-6 flex items-center gap-2 rounded-lg border border-red/20 bg-red/5 p-4 text-red-600 text-sm dark:bg-red-900/20">
					<AlertCircle className="h-4 w-4 flex-shrink-0" />
					{error}
				</div>
			)}

			<div className="space-y-6">
				<KycInputField
					id="kyc-full-name"
					label="Full Name"
					placeholder="Enter your full legal name"
					value={fullName}
					onChange={setFullName}
				/>

				<KycSelectField
					id="kyc-identification"
					label="Identification Type"
					placeholder="Select a form of identification"
					value={identificationType}
					onChange={setIdentificationType}
					options={IDENTIFICATION_OPTIONS}
				/>
			</div>

			<div className="mt-8">
				<h3 className="mb-4 font-semibold text-primary dark:text-white">
					Upload Documents
				</h3>
				<div className="grid gap-4 sm:grid-cols-2">
					<KycUploadBox
						label="Front Side"
						value={frontDocument}
						onChange={setFrontDocument}
					/>
					<KycUploadBox
						label="Back Side"
						value={backDocument}
						onChange={setBackDocument}
					/>
				</div>
			</div>

			<button
				type="button"
				disabled={
					isSubmitting ||
					!fullName ||
					fullName.length < 2 ||
					!identificationType ||
					!frontDocument ||
					!backDocument
				}
				onClick={handleSubmit}
				className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1BAA04] px-4 py-4 font-medium text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-[#232323]"
			>
				{isSubmitting ? (
					<>
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>Verifying...</span>
					</>
				) : (
					<>
						<span>Submit for Verification</span>
						<ArrowRight className="h-5 w-5" />
					</>
				)}
			</button>

			<p className="mt-4 text-center text-[#8C8C8C] text-xs">
				We use secure government services to verify your identity. Your data is
				encrypted and protected.
			</p>
		</div>
	);
}

function KycVerifyPage() {
	const { data: session, isPending: isSessionLoading } = useSession();
	const kycData = Route.useLoaderData();

	const [fullName, setFullName] = useState("");
	const [identificationType, setIdentificationType] = useState("");
	const [frontDocument, setFrontDocument] = useState<File | null>(null);
	const [backDocument, setBackDocument] = useState<File | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [showForm, setShowForm] = useState(false);

	useEffect(() => {
		if (error) {
			setError("");
		}
	}, [fullName, identificationType, frontDocument, backDocument]);

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

	const hasSubmitted = kycData && kycData.status !== "not_verified";
	const canAccessForm =
		kycData?.status === "rejected" || kycData?.status === "not_verified";

	if (hasSubmitted && !canAccessForm) {
		return <Navigate to="/kyc" />;
	}

	if (hasSubmitted && !showForm) {
		return (
			<KycShell>
				<KycHeader compact />
				<KycStatusDisplay
					status={kycData!.status}
					submittedAt={kycData!.submittedAt}
					rejectionReason={kycData!.rejectionReason}
				/>

				<button
					type="button"
					onClick={() => setShowForm(true)}
					className="mt-4 flex items-center justify-center gap-2 text-[#8C8C8C] text-sm hover:text-primary"
				>
					<RefreshCw className="h-4 w-4" />
					<span>Submit new documents</span>
				</button>
			</KycShell>
		);
	}

	const handleSubmit = async () => {
		setError("");

		if (!fullName || fullName.length < 2) {
			setError("Please enter your full name");
			return;
		}

		if (!identificationType) {
			setError("Please select a form of identification");
			return;
		}

		if (!frontDocument) {
			setError("Please upload the front of your ID");
			return;
		}

		if (!backDocument) {
			setError("Please upload the back of your ID");
			return;
		}

		setIsSubmitting(true);

		try {
			await submitKyc({
				fullName,
				identificationType: identificationType as IdentificationType,
				frontDocument,
				backDocument,
			});
			window.location.reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit KYC");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<KycShell>
			<KycHeader compact />
			{canAccessForm && showForm && (
				<button
					type="button"
					onClick={() => setShowForm(false)}
					className="mb-4 flex items-center gap-2 text-[#8C8C8C] text-sm hover:text-primary"
				>
					<ArrowRight className="h-4 w-4 rotate-180" />
					<span>Back to status</span>
				</button>
			)}
			<KycForm
				fullName={fullName}
				setFullName={setFullName}
				identificationType={identificationType}
				setIdentificationType={setIdentificationType}
				frontDocument={frontDocument}
				setFrontDocument={setFrontDocument}
				backDocument={backDocument}
				setBackDocument={setBackDocument}
				isSubmitting={isSubmitting}
				error={error}
				handleSubmit={handleSubmit}
			/>
		</KycShell>
	);
}
