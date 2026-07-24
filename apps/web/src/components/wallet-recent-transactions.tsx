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
	success: "bg-[#E2F9EE] text-[#0F9D58]",
	pending: "bg-[#FFF9E6] text-[#B58E2A]",
	failed: "bg-[#FCE8E6] text-[#C5221F]",
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
			<div className="rounded-[24px] border border-[#1B2722] bg-[#000606] p-6 md:p-8 shadow-sm">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-bold text-[24px] text-white tracking-tight">
						Recent Transactions
					</h2>
					<Link
						to="/wallet/transactions"
						className="text-[#6C7073] hover:text-white transition-colors"
						aria-label="View recent transactions"
					>
						<MoreHorizontal className="h-6 w-6" />
					</Link>
				</div>

				<div className="w-full overflow-x-auto better-scrollbar">
					{isLoading ? (
						<table className="w-full text-left border-collapse min-w-[640px]">
							<thead>
								<tr className="border-b border-[#1B2722]/50 text-[#6C7073] text-[14px] font-semibold">
									<th className="pb-4 font-semibold w-[25%]">Date & Time</th>
									<th className="pb-4 font-semibold w-[30%]">Type</th>
									<th className="pb-4 font-semibold w-[20%]">Amount</th>
									<th className="pb-4 font-semibold w-[20%]">Status</th>
									<th className="pb-4 text-right font-semibold w-[5%]">...</th>
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
						<table className="w-full text-left border-collapse min-w-[640px]">
							<thead>
								<tr className="border-b border-[#1B2722]/50 text-[#6C7073] text-[14px] font-semibold">
									<th className="pb-4 font-semibold w-[25%]">Date & Time</th>
									<th className="pb-4 font-semibold w-[30%]">Type</th>
									<th className="pb-4 font-semibold w-[20%]">Amount</th>
									<th className="pb-4 font-semibold w-[20%]">Status</th>
									<th className="pb-4 text-right font-semibold w-[5%]">
										<Link
											to="/wallet/transactions"
											className="inline-block text-[#6C7073] hover:text-white transition-colors"
										>
											<MoreHorizontal className="h-5 w-5" />
										</Link>
									</th>
								</tr>
							</thead>
							<tbody>
								{mappedTransactions.map((tx) => (
									<tr
										key={tx.id}
										className="border-b border-[#1B2722]/30 last:border-b-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
										onClick={() => setSelectedTx(tx.original)}
									>
										<td className="py-4 pr-4">
											<div className="font-semibold text-white text-[15px]">
												{tx.date}
											</div>
											<div className="text-[#6C7073] text-[13px] mt-0.5">
												{tx.time}
											</div>
										</td>
										<td className="max-w-[200px] truncate py-4 pr-4 text-white font-medium text-[15px]">
											{tx.typeLabel}
										</td>
										<td className="py-4 pr-4 text-white font-semibold text-[15px]">
											{tx.amountLabel}
										</td>
										<td className="py-4 pr-4">
											<span
												className={`inline-block min-w-[84px] rounded-full px-3 py-1.5 text-center font-bold text-xs ${statusBadgeStyles[tx.statusColor]}`}
											>
												{tx.statusText}
											</span>
										</td>
										<td className="py-4 text-right">
											<button
												type="button"
												className="text-[#6C7073] hover:text-white transition-colors p-1"
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
