import { formatAmount, formatDateTime } from "@/lib/utils";

type WalletTransaction = {
	id: string;
	userId: string;
	amount?: number | null;
	type: string;
	reference: string;
	status: string;
	createdAt?: string | null;
};

type WalletRecentTransactionsProps = {
	transactions: WalletTransaction[];
	isLoading: boolean;
};

export function WalletRecentTransactions({
	transactions,
	isLoading,
}: WalletRecentTransactionsProps) {
	return (
		<>
			<p className="mt-4 font-semibold text-[20px] text-primary dark:text-white">
				Recent Transactions
			</p>
			<div className="mt-2 rounded-2xl bg-white p-6 shadow-sm dark:bg-[#202120]">
				<div className="mt-4">
					{isLoading ? (
						<p className="text-[#6E6E6E] text-sm">Loading transactions...</p>
					) : transactions.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<img
								src="/empty-transactions.svg"
								alt="No transactions"
								className="h-auto w-full max-w-[160px]"
							/>
							<p className="mt-4 font-medium text-[20px] text-primary dark:text-white">
								Looks like you don&apos;t have any transaction yet!
							</p>
						</div>
					) : (
						<ul className="space-y-3">
							{transactions.slice(0, 10).map((transaction) => (
								<li
									key={transaction.id}
									className="flex items-center justify-between rounded-lg bg-[#F9F9F9] p-3 dark:bg-[#2B2C2B]"
								>
									<div>
										<p className="font-medium text-primary text-sm capitalize dark:text-white">
											{transaction.type}
										</p>
										<p className="text-[#6E6E6E] text-xs">
											{formatDateTime(transaction.createdAt)}
										</p>
									</div>
									<div className="text-right">
										<p className="font-semibold text-primary text-sm dark:text-white">
											₦{formatAmount(transaction.amount)}
										</p>
										<p className="text-xs uppercase">{transaction.status}</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</>
	);
}
