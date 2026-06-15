import { createFileRoute, Link } from "@tanstack/react-router";
import z from "zod";

const searchSchema = z.object({
	status: z.string().optional(),
	type: z.enum(["deposit", "withdraw"]).optional(),
	reference: z.string().optional(),
});

export const Route = createFileRoute("/wallet-transaction-status")({
	validateSearch: (search) => searchSchema.parse(search),
	component: WalletTransactionStatusPage,
});

function WalletTransactionStatusPage() {
	const search = Route.useSearch();
	const rawStatus = (search.status || "").toLowerCase();
	const normalizedStatus =
		rawStatus === "success"
			? "success"
			: rawStatus === "failed" || rawStatus === "failure"
				? "failed"
				: "pending";
	const txType = search.type || "deposit";

	const statusConfig =
		normalizedStatus === "success"
			? {
					title: `${txType === "withdraw" ? "Withdrawal" : "Deposit"} successful`,
					description: "Your transaction was completed successfully.",
					textColor: "text-[#14804A]",
				}
			: normalizedStatus === "failed"
				? {
						title: `${txType === "withdraw" ? "Withdrawal" : "Deposit"} failed`,
						description: "This transaction failed. Please try again.",
						textColor: "text-[#D13030]",
					}
				: {
						title: `${txType === "withdraw" ? "Withdrawal" : "Deposit"} pending`,
						description: "Your transaction is still being processed.",
						textColor: "text-[#B26A00]",
					};

	return (
		<div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4 py-10">
			<div className="w-full rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-[#202120]">
				<div className="mb-6 flex justify-center">
					{normalizedStatus === "success" && (
						<div className="relative flex h-24 w-24 items-center justify-center">
							<div className="absolute h-24 w-24 animate-ping rounded-full bg-[#CCF3DD]" />
							<div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#14804A] text-4xl text-white">
								✓
							</div>
						</div>
					)}
					{normalizedStatus === "failed" && (
						<div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-[#D13030] text-4xl text-white">
							×
						</div>
					)}
					{normalizedStatus === "pending" && (
						<div className="h-20 w-20 animate-spin rounded-full border-4 border-[#F2CF93] border-t-[#B26A00]" />
					)}
				</div>

				<h1 className={`font-semibold text-3xl ${statusConfig.textColor}`}>
					{statusConfig.title}
				</h1>
				<p className="mt-3 text-[#6E6E6E] text-sm">
					{statusConfig.description}
				</p>
				{search.reference && (
					<p className="mt-2 text-[#6E6E6E] text-xs">
						Reference: {search.reference}
					</p>
				)}

				<div className="mt-8 flex justify-center">
					<Link
						to="/wallet"
						className="cursor-pointer rounded-lg bg-[#F0F0F0] px-5 py-2.5 font-medium text-primary text-sm"
					>
						Back to Wallet
					</Link>
				</div>
			</div>
		</div>
	);
}
