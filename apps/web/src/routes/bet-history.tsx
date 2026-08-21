import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Outlet,
	useLocation,
	useNavigate,
} from "@tanstack/react-router";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import Trophy from "@/logos/trophy.svg?react";

export const Route = createFileRoute("/bet-history")({
	component: BetHistoryPage,
});

type BetStatus = "success" | "pending" | "failed";

type BetSelectionSummary = {
	home: string;
	away: string;
	market: string;
};

type BetHistoryItem = {
	id: string;
	ticketId: string;
	type: string;
	amount: number;
	multiplier: number;
	status: BetStatus;
	placedAt: string;
	totalOdds?: string | null;
	potentialWin?: number | null;
	actualPayout?: number | null;
	settledAt?: string | null;
	betType?: string | null;
	selections?: BetSelectionSummary[];
	totalSelections?: number;
};

type BetHistoryResponse = {
	items: BetHistoryItem[];
	page: number;
	totalPages: number;
	counts: { all: number; settled: number; unsettled: number };
};

type FilterTab = "all" | "settled" | "unsettled";
type TimePeriod = "All time" | "Today" | "Last 7 days" | "Last 30 days";

const STATUS_STYLES: Record<BetStatus, { label: string; className: string }> = {
	success: {
		label: "Won",
		className: "bg-[#17351F] text-[#3DD26A]",
	},
	pending: {
		label: "Pending",
		className: "bg-[#3A3312] text-[#E8C547]",
	},
	failed: {
		label: "Lost",
		className: "bg-[#3A1420] text-[#F0668A]",
	},
};

const TIME_PERIODS: TimePeriod[] = ["All time", "Today", "Last 7 days", "Last 30 days"];

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

function formatMoney(value: number) {
	return value.toLocaleString("en-NG", { minimumFractionDigits: 2 });
}

function formatAmount(value: number) {
	return `-₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function isWithinPeriod(iso: string, period: TimePeriod) {
	if (period === "All time") return true;
	const placed = new Date(iso).getTime();
	const now = Date.now();
	const diffMs = now - placed;
	if (period === "Today") {
		const placedDate = new Date(iso);
		const today = new Date();
		return (
			placedDate.getFullYear() === today.getFullYear() &&
			placedDate.getMonth() === today.getMonth() &&
			placedDate.getDate() === today.getDate()
		);
	}
	if (period === "Last 7 days") return diffMs <= 7 * 24 * 60 * 60 * 1000;
	if (period === "Last 30 days") return diffMs <= 30 * 24 * 60 * 60 * 1000;
	return true;
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

/** Mobile-only card */
function MobileBetCard({
	bet,
	onOpen,
}: {
	bet: BetHistoryItem;
	onOpen: () => void;
}) {
	const { timePart } = formatDateTime(bet.placedAt);
	const isWon = bet.status === "success";
	const isPending = bet.status === "pending";

	const visibleSelections = bet.selections?.slice(0, 3) ?? [];
	const hasSelections = visibleSelections.length > 0;
	
	const remainingCount =
		bet.totalSelections !== undefined
			? Math.max(0, bet.totalSelections - visibleSelections.length)
			: 0;

	return (
		<button
			type="button"
			onClick={onOpen}
			className={`relative w-full overflow-hidden rounded-2xl text-left transition-colors ${isWon
					? "bg-gradient-to-b from-[#051C01] via-[#04100B] to-[#04100B]"
					: "border border-[#1B2A17] bg-black"
				}`}
		>
			{isWon && <span className="absolute inset-x-0 top-0 h-1 bg-[#23BF09]" />}

			<div className="px-4 py-3">
				<div className="flex items-center justify-between ">
					<span className="text-sm">
						<span className="text-[#8C8F8F]">{timePart}</span>{" "}
						<span className="font-bold text-white">{bet.betType ?? "Multiple"}</span>
					</span>
					{isWon && (
						<span className="flex items-center gap-1.5 font-semibold text-[#23BF09] text-sm">
							<Trophy className="h-4 w-4" fill="#FF9500" stroke="#FF9500" />
							Won
						</span>
					)}
					{isPending && (
						<span className="font-semibold text-[#E8C547] text-sm">Pending</span>
					)}
					{!isWon && !isPending && (
						<span className="font-medium text-[#8C8F8F] text-sm">Lost</span>
					)}
				</div>

				<div className="mt-3 space-y-1.5">
{					hasSelections ? (
						visibleSelections.map((sel, i) => (
							<div key={i} className="flex items-center justify-between text-sm">
								<span className="flex items-center gap-2 text-white">
									<span>{sel.home}</span>
									<span className="text-[#6B6E6C] text-xs">vs</span>
									<span>{sel.away}</span>
								</span>
								<span className="text-[#8C8F8F] text-xs">({sel.market})</span>
							</div>
						))
					) : (
						<div className="text-[#B5B7B5] text-sm">{bet.type}</div>
					)}
					
					{hasSelections && remainingCount > 0 && (
						<div className="text-[#5A5D5B] text-xs">
							And {remainingCount} other selection...
						</div>
					)}
				</div>

				<div className="mt-3 space-y-1 border-[#1B2A17] border-t pt-3">
					<div className="flex items-center justify-between text-sm">
						<span className="text-[#8C8F8F]">Stake</span>
						<span className="font-medium text-white">{formatMoney(bet.amount)}</span>
					</div>
					{isWon && bet.actualPayout != null && (
						<div className="flex items-center justify-between text-sm">
							<span className="text-[#8C8F8F]">Total Return</span>
							<span className="font-semibold text-[#23BF09]">
								{formatMoney(bet.actualPayout)}
							</span>
						</div>
					)}
				</div>
			</div>
		</button>
	);
}

function BetHistoryPage() {
	const [activeTab, setActiveTab] = useState<FilterTab>("all");
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("All categories");
	const [isCategoryOpen, setIsCategoryOpen] = useState(false);
	const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("All time");
	const [isPeriodOpen, setIsPeriodOpen] = useState(false);
	const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);

	const location = useLocation();
	const navigate = useNavigate();
	const isBetHistoryRoot = location.pathname === "/bet-history";

	const categoryRef = useRef<HTMLDivElement>(null);
	const periodRef = useRef<HTMLDivElement>(null);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["bet-history", activeTab, page, search],
		queryFn: () => fetchBetHistory({ page, tab: activeTab, search }),
		enabled: isBetHistoryRoot,
	});

	const baseRows = data?.items ?? [];
	const loading = isLoading;
	const errored = isError;

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (categoryRef.current && !categoryRef.current.contains(target)) {
				setIsCategoryOpen(false);
			}
			if (periodRef.current && !periodRef.current.contains(target)) {
				setIsPeriodOpen(false);
			}
			if (!(target as HTMLElement).closest("[data-bet-menu]")) {
				setOpenRowMenu(null);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const categories = useMemo(() => {
		const unique = new Set(
			baseRows.map((item) => {
				const parts = item.type.split(" - ");
				return parts[0] || item.type;
			}),
		);
		return ["All categories", ...Array.from(unique)];
	}, [baseRows]);

	const filteredRows = useMemo(() => {
		return baseRows.filter((bet) => {
			if (selectedCategory !== "All categories") {
				const cat = bet.type.split(" - ")[0];
				if (cat !== selectedCategory) return false;
			}
			if (!isWithinPeriod(bet.placedAt, selectedPeriod)) return false;
			if (
				search.trim() &&
				!bet.ticketId.toLowerCase().includes(search.trim().toLowerCase())
			) {
				return false;
			}
			return true;
		});
	}, [baseRows, selectedCategory, selectedPeriod, search]);

	// Group rows by date for the mobile 
	const groupedByDate = useMemo(() => {
		const groups = new Map<string, BetHistoryItem[]>();
		for (const bet of filteredRows) {
			const { datePart } = formatDateTime(bet.placedAt);
			const existing = groups.get(datePart) ?? [];
			existing.push(bet);
			groups.set(datePart, existing);
		}
		return Array.from(groups.entries());
	}, [filteredRows]);

	const totalPages = data?.totalPages ?? 1;
	const tabCounts = data?.counts;

	const tabs: { key: FilterTab; label: string; count?: number }[] = [
		{ key: "all", label: "All", count: tabCounts?.all },
		{ key: "settled", label: "Settled", count: tabCounts?.settled },
		{ key: "unsettled", label: "Unsettled", count: tabCounts?.unsettled },
	];

	const goToTicket = (ticketId: string) => {
		navigate({ to: "/bet-history/$ticketId", params: { ticketId } });
	};

	return (
		<div className="min-h-screen bg-background px-4 py-0 text-white lg:container lg:mx-auto lg:px-0">
			{isBetHistoryRoot ? (
				<>
					<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<h1 className="font-bold text-2xl text-white ">Bet History</h1>
						<div className="relative w-full sm:w-64">
							<Input
								value={search}
								onChange={(event) => {
									setSearch(event.target.value);
									setPage(1);
								}}
								placeholder="Search by ticket ID..."
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
										className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-colors ${isActive
												? "bg-accent text-white"
												: "bg-[#141514] text-[#8C8F8F] hover:text-white"
											}`}
									>
										{tab.label}
										{typeof tab.count === "number" && (
											<span
												className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${isActive
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

						<div className="hidden items-center gap-2 sm:flex">
							<div ref={categoryRef} className="relative">
								<button
									type="button"
									onClick={() => {
										setIsCategoryOpen((prev) => !prev);
										setIsPeriodOpen(false);
									}}
									className="flex items-center gap-2 rounded-lg border border-[#2A2B2A] bg-[#141514] px-3 py-2 text-sm text-[#B5B7B5] hover:bg-[#1C1D1F]"
								>
									{selectedCategory}
									<ChevronDown className="h-4 w-4" />
								</button>
								{isCategoryOpen && (
									<div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-[#2A2B2A] bg-[#141514] shadow-lg">
										{categories.map((cat) => (
											<button
												key={cat}
												type="button"
												onClick={() => {
													setSelectedCategory(cat);
													setIsCategoryOpen(false);
													setPage(1);
												}}
												className={`block w-full px-4 py-2 text-left text-sm hover:bg-[#1C1D1F] ${cat === selectedCategory ? "text-white" : "text-[#B5B7B5]"
													}`}
											>
												{cat}
											</button>
										))}
									</div>
								)}
							</div>

							<div ref={periodRef} className="relative">
								<button
									type="button"
									onClick={() => {
										setIsPeriodOpen((prev) => !prev);
										setIsCategoryOpen(false);
									}}
									className="flex items-center gap-2 rounded-lg border border-[#2A2B2A] bg-[#141514] px-3 py-2 text-sm text-[#B5B7B5] hover:bg-[#1C1D1F]"
								>
									<SlidersHorizontal className="h-4 w-4" />
									{selectedPeriod}
								</button>
								{isPeriodOpen && (
									<div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-[#2A2B2A] bg-[#141514] shadow-lg">
										{TIME_PERIODS.map((period) => (
											<button
												key={period}
												type="button"
												onClick={() => {
													setSelectedPeriod(period);
													setIsPeriodOpen(false);
													setPage(1);
												}}
												className={`block w-full px-4 py-2 text-left text-sm hover:bg-[#1C1D1F] ${period === selectedPeriod ? "text-white" : "text-[#B5B7B5]"
													}`}
											>
												{period}
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* DESKTOP: table view */}
					<div className="hidden overflow-hidden rounded-2xl border border-[#1C1D1F] bg-[#0A0A0A] md:block">
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

									{!loading && !errored && filteredRows.length === 0 && (
										<tr>
											<td colSpan={7} className="px-6 py-16 text-center">
												<div className="flex flex-col items-center gap-2">
													<span className="text-[#6B6E6C] text-sm">
														{baseRows.length === 0
															? "No bets placed yet"
															: "No bets match your filters"}
													</span>
													{baseRows.length === 0 && (
														<span className="text-[#4A4D4B] text-xs">
															Your bet history will show up here once you place a bet.
														</span>
													)}
												</div>
											</td>
										</tr>
									)}

									{!loading &&
										!errored &&
										filteredRows.map((bet, index) => {
											const { datePart, timePart } = formatDateTime(bet.placedAt);
											const status = STATUS_STYLES[bet.status];
											return (
												<tr
													key={bet.id}
													className={`border-[#1C1D1F] border-b last:border-none hover:bg-[#151F19] ${index % 2 === 0 ? "bg-[#0F1A13]" : "bg-transparent"
														}`}
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
														<div className="relative" data-bet-menu>
															<button
																type="button"
																onClick={() =>
																	setOpenRowMenu((prev) => (prev === bet.id ? null : bet.id))
																}
																className="hover:text-white"
															>
																•••
															</button>
															{openRowMenu === bet.id && (
																<div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-[#2A2B2A] bg-[#141514] shadow-lg">
																	<button
																		type="button"
																		onClick={() => {
																			goToTicket(bet.ticketId);
																			setOpenRowMenu(null);
																		}}
																		className="block w-full px-4 py-2 text-left text-sm text-[#B5B7B5] hover:bg-[#1C1D1F] hover:text-white"
																	>
																		View transaction info
																	</button>
																</div>
															)}
														</div>
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

					{/* MOBILE: Figma-matched card list, grouped by date */}
					<div className="space-y-5 md:hidden">
						{loading && (
							<div className="py-10 text-center text-[#6B6E6C] text-sm">
								Loading your bet history...
							</div>
						)}

						{errored && !loading && (
							<div className="py-10 text-center text-[#F0668A] text-sm">
								Couldn't load bet history. Try again.
							</div>
						)}

						{!loading && !errored && filteredRows.length === 0 && (
							<div className="flex flex-col items-center gap-2 py-16 text-center">
								<span className="text-[#6B6E6C] text-sm">
									{baseRows.length === 0
										? "No bets placed yet"
										: "No bets match your filters"}
								</span>
								{baseRows.length === 0 && (
									<span className="text-[#4A4D4B] text-xs">
										Your bet history will show up here once you place a bet.
									</span>
								)}
							</div>
						)}

						{!loading &&
							!errored &&
							groupedByDate.map(([dateLabel, bets]) => (
								<div key={dateLabel}>
									<div className="mb-3 text-center text-[#6B6E6C] text-xs">
										{dateLabel}
									</div>
									<div className="space-y-3">
										{bets.map((bet) => (
											<MobileBetCard
												key={bet.id}
												bet={bet}
												onOpen={() => goToTicket(bet.ticketId)}
											/>
										))}
									</div>
								</div>
							))}

						{!loading && !errored && filteredRows.length > 0 && (
							<div className="flex items-center justify-between pt-2 pb-4">
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
						)}
					</div>
				</>
			) : (
				<Outlet />
			)}
		</div>
	);
}