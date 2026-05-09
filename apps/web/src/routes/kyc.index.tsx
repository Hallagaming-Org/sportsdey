import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
	ChevronRight,
	Loader2,
	Shield,
	ArrowRight,
} from "lucide-react";
import {
	KycCheckIcon,
	KycHeader,
	KycInfoCard,
	KycSecurityIllustration,
	KycShell,
} from "@/components/kyc";
import { useSession } from "@/lib/auth/client";
import { getKycStatus, type KycInfo } from "@/lib/kyc";

export const Route = createFileRoute("/kyc/")({
	loader: async (): Promise<KycInfo | null> => {
		try {
			return await getKycStatus();
		} catch {
			return null;
		}
	},
	component: KycPage,
});

const benefits = [
	"Secure your funds",
	"Prevent Fraud",
	"Maintain regulatory compliance",
];

function StatusCard({
	status,
	submittedAt,
	rejectionReason,
}: {
	status: string;
	submittedAt?: string;
	rejectionReason?: string | null;
}) {
	const isApproved = status === "approved";
	const isPending = status === "pending_review";
	const isRejected = status === "rejected";

	const config = isApproved
		? {
				title: "Identity Verified",
				description: "Your identity has been successfully verified.",
				iconBg: "bg-[#14804A]",
				pingBg: "bg-[#CCF3DD]",
				textColor: "text-[#14804A]",
				icon: "✓",
				animation: "ping",
		  }
		: isPending
			? {
					title: "Under Review",
					description: "Your documents are being reviewed. This usually takes 1-2 business days.",
					iconBg: "bg-[#B26A00]",
					pingBg: "bg-[#F2CF93]",
					textColor: "text-[#B26A00]",
					icon: "",
					animation: "spinner",
			  }
			: {
					title: "Verification Failed",
					description: rejectionReason || "We couldn't verify your documents. Please try again.",
					iconBg: "bg-[#D13030]",
					pingBg: "bg-[#FADBD8]",
					textColor: "text-[#D13030]",
					icon: "×",
					animation: "pulse",
			  };

	const date = submittedAt
		? new Date(submittedAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
		  })
		: null;

	return (
		<div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-[#202120]">
			<div className="mb-6 flex justify-center">
				{isApproved && (
					<div className="relative flex h-24 w-24 items-center justify-center">
						<div className={`absolute h-24 w-24 animate-ping rounded-full ${config.pingBg}`} />
						<div className={`relative flex h-20 w-20 items-center justify-center rounded-full ${config.iconBg} text-4xl text-white`}>
							{config.icon}
						</div>
					</div>
				)}
				{isRejected && (
					<div className={`flex h-20 w-20 animate-pulse items-center justify-center rounded-full ${config.iconBg} text-4xl text-white`}>
						{config.icon}
					</div>
				)}
				{isPending && (
					<div className={`h-20 w-20 animate-spin rounded-full border-4 border-[#F2CF93] border-t-[#B26A00]`} />
				)}
			</div>

			<h1 className={`font-semibold text-3xl ${config.textColor}`}>
				{config.title}
			</h1>
			<p className="mt-3 text-[#6E6E6E] text-sm">{config.description}</p>
			{date && (
				<p className="mt-2 text-[#6E6A00] text-xs">
					Submitted on {date}
				</p>
			)}

			{status !== "approved" && (
				<div className="mt-8 flex justify-center">
					<Link
						to="/kyc/verify"
						className="flex items-center gap-2 rounded-lg bg-[#45BF35] px-5 py-2.5 font-medium text-white"
					>
						{isRejected ? "Resubmit Documents" : "Continue Verification"}
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			)}

			{status === "approved" && (
				<div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#CCF3DD] px-4 py-2 text-sm text-[#14804A] dark:bg-[#14804A]/20">
					<Shield className="h-4 w-4" />
					<span className="font-medium">Verified</span>
				</div>
			)}
		</div>
	);
}

function KycLanding() {
	return (
		<>
			<div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#202120] sm:p-8">
				<div className="grid items-center gap-8 lg:grid-cols-[1fr_260px]">
					<div>
						<h2 className="font-semibold text-[30px] text-primary leading-tight dark:text-white">
							Verify Your Identity
						</h2>
						<p className="mt-2 text-[14px] text-primary dark:text-white">
							We take extra steps to protect and secure your account.
						</p>
						<ul className="mt-6 space-y-4">
							{benefits.map((benefit) => (
								<li
									key={benefit}
									className="flex items-center gap-3 text-[14px] text-primary dark:text-white"
								>
									<KycCheckIcon className="h-6 w-6 stroke-[3] text-accent" />
									<span>{benefit}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="hidden justify-self-center lg:block">
						<KycSecurityIllustration />
					</div>
				</div>
				<Link
					to="/kyc/verify"
					className="mt-10 flex w-full items-center justify-center gap-2 rounded-lg bg-[#45BF35] px-4 py-4 font-medium text-sm text-white transition-colors hover:bg-accent"
				>
					Start Verification
					<ChevronRight className="h-5 w-5" />
				</Link>
			</div>
			<KycInfoCard />
		</>
	);
}

function KycWithStatus({ kycData }: { kycData: KycInfo }) {
	return (
		<>
			<div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#202120] sm:p-8">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-semibold text-[30px] text-primary leading-tight dark:text-white">
						Identity Verification
					</h2>
				</div>

				<StatusCard
					status={kycData.status}
					submittedAt={kycData.submittedAt}
					rejectionReason={kycData.rejectionReason}
				/>

				{kycData.documents.front && kycData.status !== "pending_review" && (
					<div className="mt-6 grid gap-4 sm:grid-cols-2">
						<div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
							<p className="mb-2 text-sm font-medium text-gray-500">Front Document</p>
							{kycData.documents.front.url.endsWith(".pdf") ? (
								<div className="flex items-center gap-2 text-sm text-primary dark:text-white">
									<span className="truncate">{kycData.documents.front.id}.pdf</span>
								</div>
							) : (
								<img
									src={kycData.documents.front.url}
									alt="Front document"
									className="h-32 w-full rounded-lg object-cover"
								/>
							)}
						</div>
						{kycData.documents.back && (
							<div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
								<p className="mb-2 text-sm font-medium text-gray-500">Back Document</p>
								{kycData.documents.back.url.endsWith(".pdf") ? (
									<div className="flex items-center gap-2 text-sm text-primary dark:text-white">
										<span className="truncate">{kycData.documents.back.id}.pdf</span>
									</div>
								) : (
									<img
										src={kycData.documents.back.url}
										alt="Back document"
										className="h-32 w-full rounded-lg object-cover"
									/>
								)}
							</div>
						)}
					</div>
				)}
			</div>
			<KycInfoCard />
		</>
	);
}

function KycPage() {
	const { data: session, isPending: isSessionLoading } = useSession();
	const kycData = Route.useLoaderData();

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

	return (
		<KycShell>
			<KycHeader />
			{hasSubmitted ? <KycWithStatus kycData={kycData!} /> : <KycLanding />}
		</KycShell>
	);
}