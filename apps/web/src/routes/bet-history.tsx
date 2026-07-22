import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/bet-history")({
	component: BetHistoryPage,
});

type BetStatus = "success" | "pending" | "failed";

type BetHistoryItem = {
	id: string;
	ticketId: string;
	type: string;
	amount: number;
	multiplier: number;
	status: BetStatus;
	placedAt: string;
};

type BetHistoryResponse = {
	items: BetHistoryItem[];
	page: number;
	totalPages: number;
	counts: { all: number; settled: number; unsettled: number };
};

type FilterTab = "all" | "settled" | "unsettled";

const MOCK_BET_HISTORY: BetHistoryItem[] = [
	{ id: "1", ticketId: "2505150912345", type: "Bets - Sport", amount: 150000, multiplier: 17.84, status: "success", placedAt: "2025-08-08T22:42:00" },
	{ id: "2", ticketId: "2505150912346", type: "Bets - Aviator", amount: 80000, multiplier: 17.84, status: "pending", placedAt: "2025-08-08T22:42:00" },
	{ id: "3", ticketId: "2505150912347", type: "Bets - Trading", amount: 50000, multiplier: 17.84, status: "failed", placedAt: "2025-08-08T22:42:00" },
	{ id: "4", ticketId: "2505150912348", type: "Bets - Under/Over", amount: 50000, multiplier: 17.84, status: "success", placedAt: "2025-08-08T22:42:00" },
	{ id: "5", ticketId: "2505150912349", type: "Bets - Sport", amount: 50000, multiplier: 17.84, status: "pending", placedAt: "2025-08-08T22:42:00" },
	{ id: "6", ticketId: "2505150912350", type: "Bets - Bingo", amount: 50000, multiplier: 17.84, status: "failed", placedAt: "2025-08-08T22:42:00" },
	{ id: "7", ticketId: "2505150912351", type: "Bets - Prediction", amount: 50000, multiplier: 17.84, status: "success", placedAt: "2025-08-08T22:42:00" },
];

const USE_MOCK_DATA = true; // false once the real endpoint is ready

const STATUS_STYLES: Record<BetStatus, { label: string; className: string }> = {
	success: {
		label: "Success",
		className: "bg-[#17351F] text-[#3DD26A]",
	},
	pending: {
		label: "Pending",
		className: "bg-[#3A3312] text-[#E8C547]",
	},
	failed: {
		label: "Failed",
		className: "bg-[#3A1420] text-[#F0668A]",
	},
};

function formatDateTime(iso: string) {
	const date = new Date(iso);
	const datePart = date.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
	const timePart = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
	return { datePart, timePart };
}

function formatAmount(value: number) {
	return `-₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

async function fetchBetHistory(params: {
	page: number;
	tab: FilterTab;
	search: string;
}): Promise<BetHistoryResponse> {
	const query = new URLSearchParams({
		page: String(params.page),
		filter: params.tab,
	});
	if (params.search) query.set("search", params.search);

	return apiRequest<BetHistoryResponse>(`bet-history?${query.toString()}`, {
		method: "GET",
		credentials: "include",
	});
}

function BetHistoryPage() {
	const [activeTab, setActiveTab] = useState<FilterTab>("all");
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");

	const { data, isLoading, isError } = useQuery({
		queryKey: ["bet-history", activeTab, page, search],
		queryFn: () => fetchBetHistory({ page, tab: activeTab, search }),
		enabled: !USE_MOCK_DATA,
	});

	const rows = USE_MOCK_DATA ? MOCK_BET_HISTORY : (data?.items ?? []);
	const totalPages = USE_MOCK_DATA ? 10 : (data?.totalPages ?? 1);
	const tabCounts = USE_MOCK_DATA
		? { all: 7, settled: 5, unsettled: 2 }
		: data?.counts;
	const loading = USE_MOCK_DATA ? false : isLoading;
	const errored = USE_MOCK_DATA ? false : isError;

	const tabs: { key: FilterTab; label: string; count?: number }[] = [
		{ key: "all", label: "All", count: tabCounts?.all },
		{ key: "settled", label: "Settled", count: tabCounts?.settled },
		{ key: "unsettled", label: "Unsettled", count: tabCounts?.unsettled },
	];

	return (
		<div className="min-h-screen bg-background px-4 py-0 text-white lg:container lg:mx-auto lg:px-0">
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="font-bold text-2xl text-white ">Bet History</h1>
				<div className="relative w-full sm:w-64">
					<Input
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
						placeholder="Search..."
						className="h-10 rounded-lg border bg-[#141514] pl-4 text-sm text-white placeholder:text-[#8C8F8F]"
					/>
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#8C8F8F]" />

				</div>
			</div>

			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					{tabs.map((tab) => {
						const isActive = tab.key === activeTab;
						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => {
									setActiveTab(tab.key);
									setPage(1);
								}}
								className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
									isActive
										? "bg-accent text-white"
										: "bg-[#141514] text-[#8C8F8F] hover:text-white"
								}`}
							>
								{tab.label}
								{typeof tab.count === "number" && (
									<span
										className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
											isActive
												? "bg-[#2A2B2A]  text-white"
												: "bg-[#2A2B2A] text-[#8C8F8F]"
										}`}
									>
										{tab.count}
									</span>
								)}
							</button>
						);
					})}
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						className="flex items-center gap-2 rounded-lg border border-[#2A2B2A] bg-[#141514] px-3 py-2 text-sm text-[#B5B7B5] hover:bg-[#1C1D1F]"
					>
						All categories
						<ChevronDown className="h-4 w-4" />
					</button>
					<button
						type="button"
						className="flex items-center gap-2 rounded-lg border border-[#2A2B2A] bg-[#141514] px-3 py-2 text-sm text-[#B5B7B5] hover:bg-[#1C1D1F]"
					>
						<SlidersHorizontal className="h-4 w-4" />
						Time period
					</button>
				</div>
			</div>

			<div className="overflow-hidden rounded-2xl border border-[#1C1D1F] bg-[#0A0A0A]">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[720px] border-collapse text-left">
						<thead>
							<tr className="border-[#1C1D1F] border-b text-white text-xs tracking-wide">
								<th className="px-6 py-4 font-medium">Date &amp; Time</th>
								<th className="px-6 py-4 font-medium">Ticket ID.</th>
								<th className="px-6 py-4 font-medium">Type</th>
								<th className="px-6 py-4 font-medium">Amount</th>
								<th className="px-6 py-4 font-medium">Multiplier</th>
								<th className="px-6 py-4 font-medium">Status</th>
								<th className="px-6 py-4 font-medium" />
							</tr>
						</thead>
						<tbody>
							{loading && (
								<tr>
									<td colSpan={7} className="px-6 py-10 text-center text-[#6B6E6C]">
										Loading your bet history...
									</td>
								</tr>
							)}

							{errored && !loading && (
								<tr>
									<td colSpan={7} className="px-6 py-10 text-center text-[#F0668A]">
										Couldn't load bet history. Try again.
									</td>
								</tr>
							)}

							{!loading && !errored && rows.length === 0 && (
								<tr>
									<td colSpan={7} className="px-6 py-10 text-center text-[#6B6E6C]">
										No bets placed yet.
									</td>
								</tr>
							)}

							{!loading &&
								!errored &&
								rows.map((bet) => {
									const { datePart, timePart } = formatDateTime(bet.placedAt);
									const status = STATUS_STYLES[bet.status];
									return (
										<tr
											key={bet.id}
											className="border-[#1C1D1F] border-b last:border-none hover:bg-[#111211]"
										>
											<td className="px-6 py-4 text-sm">
												<div className="text-white">{datePart}</div>
												<div className="text-[#6B6E6C] text-xs">{timePart}</div>
											</td>
											<td className="px-6 py-4 text-[#B5B7B5] text-sm">
												{bet.ticketId}
											</td>
											<td className="px-6 py-4 text-[#B5B7B5] text-sm">
												{bet.type}
											</td>
											<td className="px-6 py-4 font-medium text-sm text-white">
												{formatAmount(bet.amount)}
											</td>
											<td className="px-6 py-4 text-[#B5B7B5] text-sm">
												{bet.multiplier.toFixed(2)}x
											</td>
											<td className="px-6 py-4">
												<span
													className={`inline-flex rounded-full px-3 py-1 font-medium text-xs ${status.className}`}
												>
													{status.label}
												</span>
											</td>
											<td className="px-6 py-4 text-[#6B6E6C]">
												<button type="button" className="hover:text-white">
													•••
												</button>
											</td>
										</tr>
									);
								})}
						</tbody>
					</table>
				</div>

				<div className="flex items-center justify-between border-[#1C1D1F] border-t px-6 py-4">
					<span className="text-[#6B6E6C] text-sm">
						Page {page} of {totalPages}
					</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
							disabled={page <= 1}
							className="rounded-lg bg-accent px-4 py-2 font-medium text-black text-sm disabled:cursor-default disabled:opacity-40"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
							disabled={page >= totalPages}
							className="rounded-lg bg-accent px-4 py-2 font-medium text-black text-sm disabled:cursor-default disabled:opacity-40"
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}