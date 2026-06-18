import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import z from "zod";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { formatAmount } from "@/lib/utils";
import {
	formatTransactionDate,
	getTransactionDetails,
	groupTransactionsByMonth,
	type WalletTransaction,
} from "@/lib/wallet-transactions";
import EmptyStateWithdrawal from "@/logos/EmptyStateWithdrawal.png";

const statusBadgeStyles = {
	success: "bg-[#E2F9EE] text-[#0F9D58]",
	pending: "bg-[#FFF9E6] text-[#B58E2A]",
	failed: "bg-[#FCE8E6] text-[#C5221F]",
};

const searchSchema = z.object({
	month: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional(),
});

export const Route = createFileRoute("/wallet/transactions")({
	validateSearch: (search) => searchSchema.parse(search),
	component: WalletTransactionsPage,
});

function buildQueryString(search: {
	month?: string;
	from?: string;
	to?: string;
}): string {
	const params = new URLSearchParams();

	if (search.month) {
		params.set("month", search.month);
	} else {
		if (search.from) params.set("from", search.from);
		if (search.to) params.set("to", search.to);
	}

	const query = params.toString();
	return query ? `?${query}` : "";
}

function WalletTransactionsPage() {
	const { data: session, isPending: isSessionLoading } = useSession();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const {
		data: transactions = [],
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: ["wallet-transactions", search.month, search.from, search.to],
		queryFn: () =>
			apiRequest<WalletTransaction[]>(
				`wallet/transactions${buildQueryString(search)}`,
				{
					credentials: "include",
				},
			),
		enabled: !!session?.user,
	});

	const groupedTransactions = useMemo(
		() => groupTransactionsByMonth(transactions),
		[transactions],
	);

	const [activePicker, setActivePicker] = useState<string | null>(null);
	const pickerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!activePicker) return;
		const handler = (e: MouseEvent) => {
			if (
				pickerRef.current &&
				!pickerRef.current.contains(e.target as Node)
			) {
				setActivePicker(null);
			}
		};
		const timer = setTimeout(
			() => document.addEventListener("mousedown", handler),
			0,
		);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("mousedown", handler);
		};
	}, [activePicker]);

	const updateSearch = (nextSearch: {
		month?: string;
		from?: string;
		to?: string;
	}) => {
		navigate({
			search: nextSearch,
			replace: true,
		});
	};

	const clearFilters = () => updateSearch({});

	const handleMonthChange = (value: string) => {
		updateSearch(
			value
				? {
						month: value,
						from: undefined,
						to: undefined,
					}
				: {},
		);
	};

	if (!isSessionLoading && !session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	if (error instanceof ApiError && error.status === 401) {
		return <Navigate to="/auth/sign-in" />;
	}

	const transactionsContent =
		error && !(error instanceof ApiError && error.status === 401) ? (
			<div className="flex min-h-[360px] flex-col items-center justify-center text-center">
				<p className="font-semibold text-lg text-primary dark:text-white">
					Unable to load transactions
				</p>
				<p className="mt-2 max-w-md text-[#6C7073] text-sm">
					{error instanceof ApiError
						? error.message
						: "Something went wrong while loading transactions."}
				</p>
				<div className="mt-6">
					<Button
						type="button"
						variant="outline"
						onClick={() => refetch()}
						className="border-[#1B2722] bg-[#04100B] text-white hover:bg-[#0C1A13]"
					>
						Retry
					</Button>
				</div>
			</div>
		) : isSessionLoading || isLoading ? (
			<div className="space-y-4">
				{[...Array(3)].map((_, groupIndex) => (
					<div key={groupIndex} className="space-y-3">
						<Skeleton className="h-6 w-32 bg-[#1C1C1E]" />
						<div className="rounded-[24px] border border-[#1C1C1E] bg-[#04100B] p-4">
							{[...Array(3)].map((__, rowIndex) => (
								<div
									key={rowIndex}
									className="flex items-center justify-between gap-4 border-[#1C1C1E] border-b py-4 last:border-b-0"
								>
									<div className="flex items-center gap-4">
										<Skeleton className="h-12 w-12 rounded-full bg-[#1C1C1E]" />
										<div className="space-y-2">
											<Skeleton className="h-4 w-36 bg-[#1C1C1E]" />
											<Skeleton className="h-3 w-24 bg-[#1C1C1E]" />
										</div>
									</div>
									<Skeleton className="h-8 w-24 rounded-full bg-[#1C1C1E]" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		) : groupedTransactions.length === 0 ? (
			<div className="flex min-h-[360px] flex-col items-center justify-center text-center">
				<img
					src={EmptyStateWithdrawal}
					alt="No transactions"
					className="mx-auto h-20 w-20 max-w-[180px]"
				/>
				<p className="mt-4 font-medium text-base text-primary dark:text-[#9CA3AF]">
					No transactions found for this filter.
				</p>
				<p className="mt-2 max-w-md text-[#6C7073] text-sm">
					Try a different month or widen the date range.
				</p>
				<div className="mt-6">
					<Button
						type="button"
						variant="outline"
						onClick={clearFilters}
						className="border-[#1B2722] bg-[#04100B] text-white hover:bg-[#0C1A13]"
					>
						Reset filters
					</Button>
				</div>
			</div>
		) : (
			<div className="space-y-8">
				{groupedTransactions.map((group) => (
					<section key={group.monthKey} className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="relative">
								<button
									type="button"
									onClick={() =>
										setActivePicker(
											activePicker === group.monthKey
												? null
												: group.monthKey,
										)
									}
									className="flex cursor-pointer items-center gap-2 border-none bg-transparent p-0"
								>
									<h2 className="font-semibold text-[18px] text-primary dark:text-white">
										{group.label}
									</h2>
									<ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
								</button>
								{activePicker === group.monthKey && (
									<div
										ref={pickerRef}
										className="absolute top-full left-0 z-50 mt-1"
									>
										<input
											type="month"
											value={group.monthKey}
											onChange={(e) => {
												handleMonthChange(e.target.value);
												setActivePicker(null);
											}}
											autoFocus
											className="w-48 rounded-lg border border-[#1B2722] bg-[#04100B] px-3 py-2 text-white shadow-lg [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[#1EAD5F]"
										/>
									</div>
								)}
							</div>
							<span className="rounded-full border border-[#1B2722] bg-[#04100B] px-3 py-1 text-[#9CA3AF] text-xs">
								{group.transactions.length} transaction
								{group.transactions.length === 1 ? "" : "s"}
							</span>
						</div>
						<div className="overflow-hidden rounded-[24px] border border-[#1C1C1E] bg-[#04100B]">
							{group.transactions.map((transaction, index) => {
								const { title, iconType, statusText, statusColor } =
									getTransactionDetails(transaction);
								const amount = transaction.amount ?? 0;
								const isCredit = amount >= 0;
								return (
									<div
										key={transaction.id}
										className={`flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${index !== group.transactions.length - 1 ? "border-[#1C1C1E] border-b" : ""}`}
									>
										<div className="flex items-center gap-4">
											<TransactionIcon type={iconType} />
											<div className="space-y-1">
												<p className="font-semibold text-[15px] text-white sm:text-base">
													{title}
												</p>
												<p className="text-[#9CA3AF] text-[13px] sm:text-sm">
													{formatTransactionDate(transaction.createdAt)}
												</p>
												<p className="text-[#6C7073] text-xs">
													{transaction.reference}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-3 sm:justify-end">
											<div
												className={`font-semibold text-sm ${isCredit ? "text-[#1EAD5F]" : "text-[#F87171]"}`}
											>
												{isCredit ? "+" : "-"}
												{formatAmount(Math.abs(amount))}
											</div>
											<div>
												<span
													className={`inline-block min-w-[96px] rounded-full px-4 py-1.5 text-center font-bold text-xs ${statusBadgeStyles[statusColor]}`}
												>
													{statusText}
												</span>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</section>
				))}
			</div>
		);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
			<div className="rounded-[28px] border border-[#1B2722] bg-[#04100B] p-6 shadow-sm">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div className="space-y-2">
						<p className="font-semibold text-[#6C7073] text-[12px] uppercase tracking-[0.24em]">
							Wallet
						</p>
						<h1 className="font-semibold text-[32px] text-primary dark:text-white">
							Recent Transactions
						</h1>
						<p className="max-w-2xl text-[#9CA3AF] text-sm">
							Click a month heading to filter transactions by month.
						</p>
					</div>
				</div>
			</div>

			<div className="rounded-[28px] border border-[#1C1C1E] bg-[#000000] p-4 shadow-sm sm:p-6">
				{transactionsContent}
			</div>
		</div>
	);
}

function TransactionIcon({
	type,
}: {
	type:
		| "transfer"
		| "mtn"
		| "deposit"
		| "withdrawal"
		| "electricity"
		| "airtel"
		| "default";
}) {
	switch (type) {
		case "transfer":
			return (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#1EAD5F] bg-[#000000] text-[#1EAD5F]">
					<svg viewBox="127 0 24 24" className="h-8 w-8" fill="currentColor">
						<path d="M151.07,11.62c0-.28.08-4.23-2.23-6.8-.1-.23-.59-1.16-2.16-2.29-.7-.55-1.44-1.03-2.21-1.46h0c-.1-.05-2.01-1.08-4.34-1.08-.18,0-.35.01-.52.02h0c-1.77-.04-3.53.42-4.6.9-.94.43-1.99,1.15-2.06,1.21-1.3.74-3.78,3.7-3.97,5.27-.79,1.02-1.45,5.61,0,8.41,1.02,3.89,4.85,5.83,5.16,5.98.19.12,2.28,1.43,4.84,1.43.11,0,.76.04.99.04,2.77,0,6.88-1.98,7.74-3.53,2.36-1.75,3.59-6.26,3.37-8.1ZM134.15,17.46c-1.1-1.8-1.72-4.15-1.86-4.69.35-.53,2.06-3.09,3.04-3.86.55.1,2.87.53,5.04.93.27.72,1.48,3.89,1.82,5.11-.38.45-1.87,2.21-3.34,3.58-1.56,0-4.21-.9-4.71-1.08ZM147.97,4.88c0,.17-.05.79-.34,1.51-.58-.3-2.05-.95-4.06-1.05-.3-.45-1.45-2.04-3.25-3.13.25-.49.59-1.09.79-1.27.06-.02.17-.04.32-.04.97,0,2.64.64,2.79.7.16.08,3.16,1.72,3.75,3.29ZM131.86,12.41c-1.31-.23-2.09-.64-2.32-.78-.49-1.79-.1-3.72-.03-4,.48-.87,1.85-3.09,2.75-3.51.94-.19,2.1.05,2.58.16-.04.63-.13,2.37.12,4.21-1.04.84-2.68,3.27-3.1,3.91ZM139.49.59c.29.02.73.09,1.02.18-.29.4-.6.99-.74,1.28-.6.1-2.89.54-4.68,1.72-.36-.1-1.45-.36-2.49-.27.26-.5.64-.87.68-.91.14-.1,2.88-2.04,6.2-2h0ZM146.8,15.36c-.45-.02-2.17-.12-4.07-.57-.36-1.28-1.56-4.44-1.83-5.15.87-1.26,1.76-2.5,2.65-3.74,2.18.12,3.71.93,4.01,1.09,1.26,2.05,1.54,4.15,1.58,4.5-.67,2.11-2,3.53-2.33,3.87ZM128.75,10.28c.03.49.11,1.01.25,1.52-.13.33-.21.68-.26,1.03-.08-.85-.08-1.7.01-2.55ZM132.44,19.33c.58-.56,1.29-1.11,1.57-1.32.62.22,3.19,1.1,4.82,1.1.28.38,1.19,1.56,2.31,2.47-.7.69-1.7,1.01-1.88,1.07-3.11.08-6.15-1.69-6.82-3.31ZM140.67,22.64c.35-.21.72-.48,1.03-.83.5-.07,2.63-.44,4.56-1.87.13.01.34.03.57.02-1.16,1.15-3.98,2.43-6.15,2.68ZM146.57,19.39c.69-1.82.66-3.2.63-3.64.38-.38,1.68-1.78,2.41-3.92.39.07.64.17.76.22.04.15.11.51.07,1.06-.3,1.95-1.31,4.88-3.1,6.18-.18.09-.5.11-.78.1Z" />
						<path
							d="M127.38,19.21c.2,0,.4.06.56.19.18.15.29.36.3.6.01.26.14.53.45.83.31.31.75.59,1.27.86.51.26,1.06.48,1.56.68.46.18.96.36,1.25.51.04.02.08.05.12.08.16.12.35.36.35.69,0,.28-.13.48-.2.56-.13.16-.29.27-.37.31-.2.12-.48.24-.8.37-.65.26-1.6.58-2.77.95-2.34.75-5.6,1.7-9.1,2.69-6.97,1.97-14.9,4.1-18.36,5-6.87,2.27-26.02,6.36-29.3,7.15-.24.1-.57.19-.94.28-.45.11-1.03.23-1.71.35-1.37.26-3.19.55-5.36.85-4.34.61-10.08,1.28-16.35,1.79-12.5,1.03-27.18,1.48-36.94-.32-.02,0-.03,0-.05-.01-4.33-1.08-6.95-2.11-8.44-3.32-.77-.63-1.26-1.32-1.51-2.09-.25-.76-.24-1.54-.15-2.31.15-1.24,1.02-2.41,2.15-3.43,1.16-1.05,2.73-2.07,4.52-3.01,3.59-1.88,8.19-3.51,12.56-4.45.43-.09.86.17.98.59.12.43-.12.87-.54,1.01-2.5.85-5.23,1.94-7.6,3.15-2.4,1.23-4.31,2.52-5.27,3.74-.47.6-.65,1.1-.64,1.51.01.38.2.84.81,1.36,1.28,1.1,4.11,2.23,9.31,3.15,23.44,1.7,50.91-4.12,52.81-4.4,1.36-.21,18.28-3.95,29.8-7.56,5.73-1.79,11.36-3.71,16.19-5.28,4.79-1.55,8.85-2.77,11.3-3.1h.09Z"
							fill="#000000"
							stroke="#1EAD5F"
							strokeLinejoin="round"
							strokeWidth="1.67"
						/>
					</svg>
				</div>
			);
		case "electricity":
			return (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#1EAD5F] bg-[#000000]">
					<svg
						viewBox="127 0 24 24"
						className="h-8 w-8 text-[#1EAD5F]"
						fill="currentColor"
					>
						<path d="M151.07,11.62c0-.28.08-4.23-2.23-6.8-.1-.23-.59-1.16-2.16-2.29-.7-.55-1.44-1.03-2.21-1.46h0c-.1-.05-2.01-1.08-4.34-1.08-.18,0-.35.01-.52.02h0c-1.77-.04-3.53.42-4.6.9-.94.43-1.99,1.15-2.06,1.21-1.3.74-3.78,3.7-3.97,5.27-.79,1.02-1.45,5.61,0,8.41,1.02,3.89,4.85,5.83,5.16,5.98.19.12,2.28,1.43,4.84,1.43.11,0,.76.04.99.04,2.77,0,6.88-1.98,7.74-3.53,2.36-1.75,3.59-6.26,3.37-8.1ZM134.15,17.46c-1.1-1.8-1.72-4.15-1.86-4.69.35-.53,2.06-3.09,3.04-3.86.55.1,2.87.53,5.04.93.27.72,1.48,3.89,1.82,5.11-.38.45-1.87,2.21-3.34,3.58-1.56,0-4.21-.9-4.71-1.08ZM147.97,4.88c0,.17-.05.79-.34,1.51-.58-.3-2.05-.95-4.06-1.05-.3-.45-1.45-2.04-3.25-3.13.25-.49.59-1.09.79-1.27.06-.02.17-.04.32-.04.97,0,2.64.64,2.79.7.16.08,3.16,1.72,3.75,3.29ZM131.86,12.41c-1.31-.23-2.09-.64-2.32-.78-.49-1.79-.1-3.72-.03-4,.48-.87,1.85-3.09,2.75-3.51.94-.19,2.1.05,2.58.16-.04.63-.13,2.37.12,4.21-1.04.84-2.68,3.27-3.1,3.91ZM139.49.59c.29.02.73.09,1.02.18-.29.4-.6.99-.74,1.28-.6.1-2.89.54-4.68,1.72-.36-.1-1.45-.36-2.49-.27.26-.5.64-.87.68-.91.14-.1,2.88-2.04,6.2-2h0ZM146.8,15.36c-.45-.02-2.17-.12-4.07-.57-.36-1.28-1.56-4.44-1.83-5.15.87-1.26,1.76-2.5,2.65-3.74,2.18.12,3.71.93,4.01,1.09,1.26,2.05,1.54,4.15,1.58,4.5-.67,2.11-2,3.53-2.33,3.87ZM128.75,10.28c.03.49.11,1.01.25,1.52-.13.33-.21.68-.26,1.03-.08-.85-.08-1.7.01-2.55ZM132.44,19.33c.58-.56,1.29-1.11,1.57-1.32.62.22,3.19,1.1,4.82,1.1.28.38,1.19,1.56,2.31,2.47-.7.69-1.7,1.01-1.88,1.07-3.11.08-6.15-1.69-6.82-3.31ZM140.67,22.64c.35-.21.72-.48,1.03-.83.5-.07,2.63-.44,4.56-1.87.13.01.34.03.57.02-1.16,1.15-3.98,2.43-6.15,2.68ZM146.57,19.39c.69-1.82.66-3.2.63-3.64.38-.38,1.68-1.78,2.41-3.92.39.07.64.17.76.22.04.15.11.51.07,1.06-.3,1.95-1.31,4.88-3.1,6.18-.18.09-.5.11-.78.1Z" />
						<path
							d="M127.38,19.21c.2,0,.4.06.56.19.18.15.29.36.3.6.01.26.14.53.45.83.31.31.75.59,1.27.86.51.26,1.06.48,1.56.68.46.18.96.36,1.25.51.04.02.08.05.12.08.16.12.35.36.35.69,0,.28-.13.48-.2.56-.13.16-.29.27-.37.31-.2.12-.48.24-.8.37-.65.26-1.6.58-2.77.95-2.34.75-5.6,1.7-9.1,2.69-6.97,1.97-14.9,4.1-18.36,5-6.87,2.27-26.02,6.36-29.3,7.15-.24.1-.57.19-.94.28-.45.11-1.03.23-1.71.35-1.37.26-3.19.55-5.36.85-4.34.61-10.08,1.28-16.35,1.79-12.5,1.03-27.18,1.48-36.94-.32-.02,0-.03,0-.05-.01-4.33-1.08-6.95-2.11-8.44-3.32-.77-.63-1.26-1.32-1.51-2.09-.25-.76-.24-1.54-.15-2.31.15-1.24,1.02-2.41,2.15-3.43,1.16-1.05,2.73-2.07,4.52-3.01,3.59-1.88,8.19-3.51,12.56-4.45.43-.09.86.17.98.59.12.43-.12.87-.54,1.01-2.5.85-5.23,1.94-7.6,3.15-2.4,1.23-4.31,2.52-5.27,3.74-.47.6-.65,1.1-.64,1.51.01.38.2.84.81,1.36,1.28,1.1,4.11,2.23,9.31,3.15,23.44,1.7,50.91-4.12,52.81-4.4,1.36-.21,18.28-3.95,29.8-7.56,5.73-1.79,11.36-3.71,16.19-5.28,4.79-1.55,8.85-2.77,11.3-3.1h.09Z"
							fill="#000000"
							stroke="#1EAD5F"
							strokeLinejoin="round"
							strokeWidth="1.67"
						/>
					</svg>
				</div>
			);
		case "mtn":
			return (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFCC00]">
					<svg viewBox="0 0 40 40" className="h-8 w-8">
						<ellipse
							cx="20"
							cy="20"
							rx="15"
							ry="9"
							fill="none"
							stroke="#003399"
							strokeWidth="2.5"
						/>
						<text
							x="20"
							y="23.5"
							fontFamily="sans-serif"
							fontSize="8"
							fontWeight="900"
							fill="#003399"
							textAnchor="middle"
						>
							MTN
						</text>
					</svg>
				</div>
			);
		case "airtel":
			return (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E31837] text-white">
					<svg viewBox="0 0 40 40" className="h-8 w-8" fill="currentColor">
						<path
							d="M23.5 22.5c0 1.9-1.3 3.5-3.5 3.5-2.5 0-3.5-1.8-3.5-3.5 0-2 1.3-3.2 3.5-3.2h3.5v3.2zm0-5.2c-1-.5-2.2-.8-3.5-.8-4.5 0-6.5 3-6.5 6.5s2 6.5 6.5 6.5c1.8 0 3.2-.5 4.2-1.2v1c0 .6.4 1 1 1h1.8c.6 0 1-.4 1-1V17.5c0-4.5-3-6.5-7.5-6.5-2.5 0-4.5.8-5.5 1.8.4.4.8.9 1 1.5.8-.8 2-1.3 4.2-1.3 3 0 4.8 1.2 4.8 4.3v1.5z"
							fill="white"
						/>
					</svg>
				</div>
			);
		case "deposit":
			return (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#E6F4EA] bg-[#FFFFFF]">
					<svg
						viewBox="0 0 24 24"
						className="h-6 w-6"
						fill="none"
						stroke="#1EAD5F"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
						<path d="M3 3v5h5" />
					</svg>
				</div>
			);
		case "withdrawal":
			return (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FCE8E6] text-[#C5221F]">
					<svg
						viewBox="0 0 24 24"
						className="h-6 w-6"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="7" y1="17" x2="17" y2="7" />
						<polyline points="7 7 17 7 17 17" />
					</svg>
				</div>
			);
		default:
			return (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1C1C1E] text-[#9CA3AF]">
					<svg
						viewBox="0 0 24 24"
						className="h-5 w-5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<rect x="2" y="4" width="20" height="16" rx="2" />
						<line x1="12" y1="10" x2="12" y2="14" />
						<line x1="10" y1="12" x2="14" y2="12" />
					</svg>
				</div>
			);
	}
}
