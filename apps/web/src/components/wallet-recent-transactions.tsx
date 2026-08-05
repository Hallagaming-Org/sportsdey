import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
	type ReceiptDetail,
	TransactionReceipt,
} from "@/components/transaction-receipt";
import { Skeleton } from "@/components/ui/skeleton";
import {
	formatTransactionDate,
	getTransactionDetails,
	getTransactionTypeLabel,
	type WalletTransaction,
} from "@/lib/wallet-transactions";
import EmptyStateWithdrawal from "@/logos/EmptyStateWithdrawal.png";

type WalletRecentTransactionsProps = {
	transactions: WalletTransaction[];
	isLoading: boolean;
};


const statusBadgeStyles = {
	success: "bg-[#D1FAE5] text-[#065F46]",
	pending: "bg-[#FEF3C7] text-[#92400E]",
	failed: "bg-[#FEE2E2] text-[#991B1B]",
};

function parseDateTime(createdAt: string | null | undefined) {
	if (!createdAt) {
		return { date: "Aug 8, 2025", time: "10:42 pm" };
	}
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) {
		return { date: "Aug 8, 2025", time: "10:42 pm" };
	}

	const dateOptions: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	};
	const formattedDate = new Intl.DateTimeFormat("en-US", dateOptions).format(date);

	const timeOptions: Intl.DateTimeFormatOptions = {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone: "UTC",
	};
	const formattedTime = new Intl.DateTimeFormat("en-US", timeOptions)
		.format(date)
		.toLowerCase();

	return { date: formattedDate, time: formattedTime };
}

function getTransactionAmountLabel(amount?: number | null): string {
	const amountVal = Math.abs(amount ?? 0);
	return `₦${amountVal.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function truncateId(id: string): string {
	if (id.length <= 16) return id;
	return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function WalletRecentTransactions({
	transactions,
	isLoading,
}: WalletRecentTransactionsProps) {
	const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

	const mappedTransactions = (transactions || [])
		.filter((tx) => tx.amount != null && tx.amount !== 0)
		.slice(0, 10)
		.map((tx) => {
			const { statusText, statusColor } = getTransactionDetails(tx);
			const { date, time } = parseDateTime(tx.createdAt);
			const typeLabel = getTransactionTypeLabel(tx);
			const amountLabel = getTransactionAmountLabel(tx.amount);
			return {
				id: tx.id,
				date,
				time,
				typeLabel,
				amountLabel,
				statusText: statusText === "Successful" ? "Success" : statusText,
				statusColor,
				original: tx,
			};
		});

	const hasNoTransactions = !isLoading && mappedTransactions.length === 0;

	const getReceiptDetails = (tx: WalletTransaction): ReceiptDetail[] => {
		const { iconType } = getTransactionDetails(tx);
		const meta = tx.metadata as Record<string, string | undefined> | null;
		const details: ReceiptDetail[] = [];

		if (iconType === "transfer") {
			const transferType = meta?.transferType;
			if (transferType === "outgoing") {
				details.push({
					label: "Recipient Name",
					value: meta?.recipientName || "N/A",
				});
				details.push({
					label: "Recipient Wallet ID",
					value: truncateId(String(meta?.recipientWalletId || "N/A")),
				});
			} else if (transferType === "incoming") {
				details.push({
					label: "Sender Name",
					value: meta?.senderName || "N/A",
				});
				details.push({
					label: "Sender Wallet ID",
					value: truncateId(String(meta?.senderWalletId || "N/A")),
				});
			}
			details.push({
				label: "Amount",
				value: `₦${Math.abs(tx.amount || 0).toLocaleString()}`,
			});
			details.push({ label: "Fee", value: "₦0" });
			details.push({
				label: "Date",
				value: formatTransactionDate(tx.createdAt),
			});
			details.push({ label: "Transaction Type", value: "Transfer" });
		} else if (
			iconType === "mtn" ||
			iconType === "airtel" ||
			iconType === "electricity"
		) {
			details.push({
				label: "To",
				value: tx.metadata?.customerId
					? `${tx.metadata.customerId} (${tx.metadata.billerName})`
					: "Utility Bill",
			});
			details.push({
				label: "Amount",
				value: `- ₦${Math.abs(tx.amount || 0).toLocaleString()}`,
			});
			details.push({ label: "Fee", value: "₦0" });
			details.push({
				label: "Description",
				value: tx.metadata?.service
					? `${tx.metadata.service} Purchase`
					: "Bill Payment",
			});
			details.push({
				label: "Date",
				value: formatTransactionDate(tx.createdAt),
			});
			details.push({ label: "Transaction Type", value: "Bills" });
		} else if (iconType === "deposit") {
			details.push({ label: "Transaction Type", value: "Credit (Deposit)" });
			details.push({
				label: "Amount",
				value: `₦${Math.abs(tx.amount || 0).toLocaleString()}`,
			});
			details.push({ label: "Fee", value: "₦0" });
			details.push({
				label: "Date",
				value: formatTransactionDate(tx.createdAt),
			});
		} else {
			details.push({ label: "Transaction Type", value: "Debit (Withdrawal)" });
			details.push({
				label: "Amount",
				value: `- ₦${Math.abs(tx.amount || 0).toLocaleString()}`,
			});
			details.push({ label: "Fee", value: "₦0" });
			details.push({
				label: "Date",
				value: formatTransactionDate(tx.createdAt),
			});
		}

		const txId = tx.reference || tx.id;
		details.push({
			label: "Transaction ID",
			value: truncateId(txId),
			copyable: true,
		});
		return details;
	};

	return (
		<>
			<div className="rounded-2xl border border-[#1B2722] bg-[#000606] p-5 shadow-sm md:p-8">
				<div className="mb-5 flex items-center justify-between md:mb-6">
					<h2 className="font-semibold text-[22px] text-white tracking-tight md:text-[24px]">
						Recent Transactions
					</h2>
					<Link
						to="/wallet/transactions"
						className="text-[#6C7073] transition-colors hover:text-white"
						aria-label="View recent transactions"
					>
						<MoreHorizontal className="h-6 w-6" />
					</Link>
				</div>

				<div className="better-scrollbar w-full overflow-x-auto">
					{isLoading ? (
						<table className="min-w-[640px] w-full border-collapse text-left">
							<thead>
								<tr className="border-[#1B2722]/50 border-b font-semibold text-[#6C7073] text-[14px]">
									<th className="w-[25%] pb-4 font-semibold">Date & Time</th>
									<th className="w-[30%] pb-4 font-semibold">Type</th>
									<th className="w-[20%] pb-4 font-semibold">Amount</th>
									<th className="w-[20%] pb-4 font-semibold">Status</th>
									<th className="w-[5%] pb-4 text-right font-semibold">...</th>
								</tr>
							</thead>
							<tbody>
								{[...Array(5)].map((_, i) => (
									<tr
										key={i}
										className="border-b border-[#1B2722]/30 last:border-b-0"
									>
										<td className="py-4 pr-4">
											<Skeleton className="h-5 w-24 bg-[#1C1C1E]" />
											<Skeleton className="h-4 w-16 bg-[#1C1C1E] mt-1" />
										</td>
										<td className="py-4 pr-4">
											<Skeleton className="h-5 w-32 bg-[#1C1C1E]" />
										</td>
										<td className="py-4 pr-4">
											<Skeleton className="h-5 w-20 bg-[#1C1C1E]" />
										</td>
										<td className="py-4 pr-4">
											<Skeleton className="h-8 w-[84px] rounded-full bg-[#1C1C1E]" />
										</td>
										<td className="py-4 text-right">
											<Skeleton className="h-5 w-5 bg-[#1C1C1E] ml-auto rounded-full" />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : hasNoTransactions ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<img
								src={EmptyStateWithdrawal}
								alt="No transactions"
								className="mx-auto h-16 w-16 max-w-[160px]"
							/>
							<p className="mt-4 font-medium text-base text-primary dark:text-[#6C7073]">
								Looks like you don&apos;t have any transaction yet!
							</p>
						</div>
					) : (
						<table className="min-w-[640px] w-full border-collapse text-left">
							<thead>
								<tr className="border-[#1B2722]/50 border-b font-semibold text-[#6C7073] text-[14px]">
									<th className="w-[25%] pb-4 font-semibold">Date & Time</th>
									<th className="w-[30%] pb-4 font-semibold">Type</th>
									<th className="w-[20%] pb-4 font-semibold">Amount</th>
									<th className="w-[20%] pb-4 font-semibold">Status</th>
									<th className="w-[5%] pb-4 text-right font-semibold">
										<span className="sr-only">Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{mappedTransactions.map((tx) => (
									<tr
										key={tx.id}
										className="cursor-pointer border-[#1B2722]/30 border-b transition-colors last:border-b-0 hover:bg-white/[0.02]"
										onClick={() => setSelectedTx(tx.original)}
									>
										<td className="py-4 pr-4">
											<div className="font-medium text-[15px] text-white">
												{tx.date}
											</div>
											<div className="mt-0.5 text-[#6C7073] text-[13px]">
												{tx.time}
											</div>
										</td>
										<td className="max-w-[200px] truncate py-4 pr-4 font-medium text-[15px] text-white">
											{tx.typeLabel}
										</td>
										<td className="py-4 pr-4 font-semibold text-[15px] text-white">
											{tx.amountLabel}
										</td>
										<td className="py-4 pr-4">
											<span
												className={`inline-block min-w-[84px] rounded-full px-3 py-1.5 text-center font-semibold text-xs ${statusBadgeStyles[tx.statusColor]}`}
											>
												{tx.statusText}
											</span>
										</td>
										<td className="py-4 text-right">
											<button
												type="button"
												className="p-1 text-[#6C7073] transition-colors hover:text-white"
												aria-label="Transaction actions"
												onClick={(e) => {
													e.stopPropagation();
													setSelectedTx(tx.original);
												}}
											>
												<MoreHorizontal className="h-5 w-5" />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			{/* Modal for displaying the transaction receipt */}
			{selectedTx && (
				<TransactionReceipt
					details={getReceiptDetails(selectedTx)}
					statusTitle={
						selectedTx.status.toLowerCase() === "success"
							? "Successful"
							: selectedTx.status.toLowerCase() === "pending"
								? "Pending"
								: "Failed"
					}
					statusMessage={
						selectedTx.status.toLowerCase() === "success"
							? "Transaction has been completed."
							: "Transaction processing."
					}
					onBack={() => setSelectedTx(null)}
				/>
			)}
		</>
	);
}
