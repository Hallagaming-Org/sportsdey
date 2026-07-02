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
	type WalletTransaction,
} from "@/lib/wallet-transactions";
import EmptyStateWithdrawal from "@/logos/EmptyStateWithdrawal.png";

type WalletRecentTransactionsProps = {
	transactions: WalletTransaction[];
	isLoading: boolean;
};

// Mock transactions that match the mockup image exactly
const MOCK_TRANSACTIONS: WalletTransaction[] = [
	{
		id: "mock-1",
		userId: "u1",
		amount: 150000,
		type: "credit",
		reference: "TX-0123456789-1",
		status: "success",
		paymentMethod: "bank transfer",
		createdAt: "2025-08-08T22:42:00.000Z",
	},
	{
		id: "mock-2",
		userId: "u1",
		amount: 80000,
		type: "credit",
		reference: "TX-0123456789-2",
		status: "success",
		paymentMethod: "slotegrator games",
		metadata: {
			action: "win",
			game: "Aviator",
		},
		createdAt: "2025-08-08T22:42:00.000Z",
	},
	{
		id: "mock-3",
		userId: "u1",
		amount: 50000,
		type: "debit",
		reference: "TX-0123456789-3",
		status: "success",
		paymentMethod: "slotegrator games",
		metadata: {
			action: "bet",
			game: "Aviator",
		},
		createdAt: "2025-08-08T22:42:00.000Z",
	},
	{
		id: "mock-4",
		userId: "u1",
		amount: 50000,
		type: "debit",
		reference: "TX-0123456789-4",
		status: "success",
		paymentMethod: "wallet_transfer",
		metadata: {
			transferType: "to_friend",
		},
		createdAt: "2025-08-08T22:42:00.000Z",
	},
	{
		id: "mock-5",
		userId: "u1",
		amount: 50000,
		type: "debit",
		reference: "TX-0123456789-5",
		status: "pending",
		paymentMethod: "bank transfer",
		createdAt: "2025-08-08T22:42:00.000Z",
	},
	{
		id: "mock-6",
		userId: "u1",
		amount: 50000,
		type: "debit",
		reference: "TX-0123456789-6",
		status: "success",
		paymentMethod: "bills",
		metadata: {
			service: "DATA_BUNDLE",
			billerName: "Internet Bill payment",
		},
		createdAt: "2025-08-08T22:42:00.000Z",
	},
	{
		id: "mock-7",
		userId: "u1",
		amount: 50000,
		type: "debit",
		reference: "TX-0123456789-7",
		status: "failed",
		paymentMethod: "bills",
		metadata: {
			service: "DATA_BUNDLE",
			billerName: "MTN Ng Data",
			customerId: "07016",
		},
		createdAt: "2025-08-08T22:42:00.000Z",
	},
	{
		id: "mock-8",
		userId: "u1",
		amount: 50000,
		type: "debit",
		reference: "TX-0123456789-8",
		status: "success",
		paymentMethod: "bills",
		metadata: {
			service: "ELECTRICITY",
			customerId: "Electricity Bill payme...",
		},
		createdAt: "2025-08-08T22:42:00.000Z",
	},
];

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

function getTransactionTypeLabel(tx: WalletTransaction): string {
	const typeLower = (tx.type || "").toLowerCase();
	const methodLower = (tx.paymentMethod || "").toLowerCase();
	const meta = tx.metadata as Record<string, string | undefined> | null;
	const isCredit = (tx.amount ?? 0) >= 0;

	if (methodLower === "wallet_transfer") {
		const isDebit = typeLower === "debit" || (tx.amount && tx.amount < 0);
		if (meta?.transferType === "to_game_wallet") {
			return "Transfer to game";
		}
		return isDebit ? "Transfer to friend" : "Received - Transfer";
	}

	if (
		methodLower === "bank transfer" ||
		methodLower === "bank_transfer" ||
		methodLower === "paystack" ||
		methodLower === "card"
	) {
		return isCredit ? "Deposit - Transfer" : "Withdrawal";
	}

	if (
		methodLower === "slotegrator games" ||
		methodLower === "thndr games" ||
		methodLower === "lucky games" ||
		methodLower === "lagos rush" ||
		tx.id.includes("aviator") ||
		String(meta?.game).toLowerCase() === "aviator"
	) {
		const action = meta?.action || "";
		const gameName = meta?.game || "Aviator";
		if (action === "bet") {
			return `Bets - ${gameName}`;
		}
		if (action === "win") {
			return `Wininigs - ${gameName}`;
		}
		return `${gameName} Game`;
	}

	if (meta?.service) {
		const service = String(meta.service);
		const biller = meta.billerName || "";
		const customerId = meta.customerId || "";
		if (service === "AIRTIME" || service === "DATA_BUNDLE") {
			if (biller.toLowerCase().includes("mtn")) {
				return `MTN Ng Data ${customerId.slice(0, 5)}...`;
			}
			if (biller) {
				return `${biller} Data ${customerId.slice(0, 5)}...`;
			}
			return `Internet Bill payment`;
		}
		if (service === "ELECTRICITY") {
			return `Electricity Bill payme...`;
		}
		if (service === "CABLE_TV") {
			return "Cable TV payment";
		}
	}

	// Fallbacks
	if (typeLower === "credit") return "Deposit - Transfer";
	if (typeLower === "debit") return "Withdrawal";
	return "Transaction";
}

function getTransactionAmountLabel(amount?: number | null): string {
	const amountVal = Math.abs(amount ?? 0);
	return `₦${amountVal.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

export function WalletRecentTransactions({
	transactions,
	isLoading,
}: WalletRecentTransactionsProps) {
	const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

	// Fallback to MOCK_TRANSACTIONS if there are no transactions
	const displayTransactions =
		transactions && transactions.length > 0 ? transactions : MOCK_TRANSACTIONS;

	const mappedTransactions = (displayTransactions || [])
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
		const details: ReceiptDetail[] = [];

		if (iconType === "transfer") {
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

		details.push({
			label: "Transaction ID",
			value: tx.reference || tx.id,
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
										<td className="py-4 pr-4 text-white font-medium text-[15px]">
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
