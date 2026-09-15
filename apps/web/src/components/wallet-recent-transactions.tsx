import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionReceipt } from "@/components/transaction-receipt";
import { Skeleton } from "@/components/ui/skeleton";
import { isOpenfortEnabled } from "@/lib/openfort/config";
import { useOpenfortReady } from "@/lib/openfort/scope";
import { useCryptoIncomingTransactions } from "@/lib/openfort/use-crypto-transactions";
import {
	getTransactionDetails,
	getTransactionTypeLabel,
	getWalletReceiptDetails,
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
	const formattedDate = new Intl.DateTimeFormat("en-US", dateOptions).format(
		date,
	);

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

function getTransactionAmountLabel(tx: WalletTransaction): string {
	const meta = tx.metadata as Record<string, string | undefined> | null;
	if (
		(tx.paymentMethod || "").toLowerCase() === "crypto" &&
		meta?.amountLabel
	) {
		return meta.amountLabel;
	}
	const amountVal = Math.abs(tx.amount ?? 0);
	return `₦${amountVal.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function mergeRecentTransactions(
	fiat: WalletTransaction[],
	crypto: WalletTransaction[],
): WalletTransaction[] {
	return [...fiat, ...crypto]
		.filter((tx) => tx.amount != null && tx.amount !== 0)
		.sort((a, b) => {
			const aTime = new Date(a.createdAt || 0).getTime();
			const bTime = new Date(b.createdAt || 0).getTime();
			return bTime - aTime;
		})
		.slice(0, 10);
}

function WalletRecentTransactionsView({
	transactions,
	cryptoTransactions,
	isLoading,
}: {
	transactions: WalletTransaction[];
	cryptoTransactions: WalletTransaction[];
	isLoading: boolean;
}) {
	const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

	const mappedTransactions = useMemo(() => {
		return mergeRecentTransactions(transactions || [], cryptoTransactions).map(
			(tx) => {
				const { statusText, statusColor } = getTransactionDetails(tx);
				const { date, time } = parseDateTime(tx.createdAt);
				const typeLabel = getTransactionTypeLabel(tx);
				const amountLabel = getTransactionAmountLabel(tx);
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
			},
		);
	}, [transactions, cryptoTransactions]);

	const hasNoTransactions = !isLoading && mappedTransactions.length === 0;

	return (
		<>
			<div className="min-w-0 max-w-full rounded-2xl border border-[#1B2722] bg-[#000606] p-5 shadow-sm md:p-8">
				<div className="mb-5 flex items-center justify-between md:mb-6">
					<h2 className="font-semibold text-[22px] text-white tracking-tight md:text-[24px]">
						Recent Transactions
					</h2>
					<Link
						to="/wallet/transactions"
						search={{}}
						className="text-[#6C7073] transition-colors hover:text-white"
						aria-label="View recent transactions"
					>
						<MoreHorizontal className="h-6 w-6" />
					</Link>
				</div>

				<div className="better-scrollbar max-w-full touch-pan-x overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
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
										className="border-[#1B2722]/30 border-b last:border-b-0"
									>
										<td className="py-4 pr-4">
											<Skeleton className="h-5 w-24 bg-[#1C1C1E]" />
											<Skeleton className="mt-1 h-4 w-16 bg-[#1C1C1E]" />
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
											<Skeleton className="ml-auto h-5 w-5 rounded-full bg-[#1C1C1E]" />
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

			{selectedTx && (
				<TransactionReceipt
					title="Transaction Details"
					details={getWalletReceiptDetails(selectedTx)}
					statusTitle={
						["success", "completed", "successful"].includes(
							selectedTx.status.toLowerCase(),
						)
							? "Successful"
							: selectedTx.status.toLowerCase() === "pending"
								? "Pending"
								: "Failed"
					}
					statusMessage={
						["success", "completed", "successful"].includes(
							selectedTx.status.toLowerCase(),
						)
							? "Transaction has been completed."
							: selectedTx.status.toLowerCase() === "pending"
								? "Transaction is still processing."
								: "Transaction failed."
					}
					onBack={() => setSelectedTx(null)}
				/>
			)}
		</>
	);
}

function WalletRecentTransactionsWithCrypto({
	transactions,
	isLoading,
}: WalletRecentTransactionsProps) {
	const { transactions: cryptoTransactions } = useCryptoIncomingTransactions();

	return (
		<WalletRecentTransactionsView
			transactions={transactions}
			cryptoTransactions={cryptoTransactions}
			isLoading={isLoading}
		/>
	);
}

export function WalletRecentTransactions({
	transactions,
	isLoading,
}: WalletRecentTransactionsProps) {
	const openfortReady = useOpenfortReady();

	if (isOpenfortEnabled() && openfortReady) {
		return (
			<WalletRecentTransactionsWithCrypto
				transactions={transactions}
				isLoading={isLoading}
			/>
		);
	}

	return (
		<WalletRecentTransactionsView
			transactions={transactions}
			cryptoTransactions={[]}
			isLoading={isLoading}
		/>
	);
}
