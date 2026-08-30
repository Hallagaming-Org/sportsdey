import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Copy, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import Trophy from "@/logos/trophy.svg?react";

export const Route = createFileRoute("/bet-history/$ticketId")({
	component: TicketDetailsPage,
});

type SelectionStatus = "won" | "lost" | "pending";
type TicketOutcome = "won" | "lost" | "pending";

type BetSelection = {
	matchId: string | null;
	match: string;
	market: string | null;
	result: string | null;
	pick: string | null;
	odds: string | null;
	status: SelectionStatus;
	startTime: string | null;
};

type CasinoSelection = {
	id: string;
	type: string;
	amount: number;
	status: SelectionStatus;
	gameName: string;
	provider?: string;
	roundId?: string;
};

type TicketDetail = {
	ticketId: string;
	dateTime: string;
	betType: string;
	outcome: TicketOutcome;
	stake: number;
	totalOdds: number;
	totalReturn: number | null;
	potentialCashout: number | null;
	numberOfBets: number;
	selections: BetSelection[];
	isCasino?: boolean;
	casinoSelections?: CasinoSelection[];
	gameName?: string;
	provider?: string;
	roundId?: string;
	multiplier?: number;
};

async function fetchTicketDetail(ticketId: string): Promise<TicketDetail> {
	return apiRequest<TicketDetail>(
		`bet-history/${encodeURIComponent(ticketId)}`,
		{
		method: "GET",
		credentials: "include",
	});
}

function hasNotStarted(startTime: string | null): boolean {
	if (!startTime) return false;
	return new Date(startTime).getTime() > Date.now();
}

function formatKickoff(startTime: string | null): string {
	if (!startTime) return "";
	const d = new Date(startTime);
	const date = d.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "2-digit",
	});
	const time = d.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	return `${date} - ${time}`;
}

function displayMatchName(match: string | null | undefined): string {
	const trimmed = match?.trim();
	if (!trimmed) return "Unknown match";
	if (/^\d+:[0-9a-f-]{8,}$/i.test(trimmed)) return "Unknown match";
	if (
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			trimmed,
		)
	) {
		return "Unknown match";
	}
	return trimmed;
}

function formatMoney(value: number) {
	return value.toLocaleString("en-NG", { minimumFractionDigits: 2 });
}

function statusBadgeClass(status: SelectionStatus) {
	if (status === "won") return "bg-[#E6FFEF] text-[#009E2C]";
	if (status === "lost") return "bg-[#FFD9D4] text-[#C03320]";
	return "bg-[#3A3312] text-[#E8C547]";
}

function statusLabel(status: SelectionStatus) {
	if (status === "won") return "Won";
	if (status === "lost") return "Lost";
	return "Pending";
}

function selectionDetailRow(label: string, value: React.ReactNode) {
	return (
		<div className="flex items-start justify-between gap-2">
			<span className="shrink-0 text-[#8C8F8F]">{label}</span>
			<span className="min-w-0 text-right text-white break-words">{value}</span>
		</div>
	);
}

/** Mobile-only vertical card */
function SelectionCard({ selection }: { selection: BetSelection }) {
	const won = selection.status === "won";
	const lost = selection.status === "lost";

	return (
		<div
			className={`relative overflow-hidden rounded-2xl border ${
				won
					? "border-[#1F4D2C] bg-[#0A1A0E]"
					: lost
						? "border-[#1C1D1F] bg-[#0A0A0A]"
						: "border-[#3A3312] bg-[#14120A]"
			}`}
		>
			<div className="flex">
				<div
					className={`flex w-8 shrink-0 flex-col items-center gap-2 pt-3 pb-2 ${
						won ? "bg-[#123018]" : lost ? "bg-[#1A1A1A]" : "bg-[#3A3312]"
					}`}
				>
					{won && <Trophy className="h-4 w-4 text-[#E8A93D]" fill="#E8A93D" />}
					{!won && (
						<span className="mt-0.5 h-2 w-2 rounded-full bg-[#8C8F8F]" />
					)}
					<span
						className={`text-center font-bold text-xs tracking-wide [writing-mode:vertical-rl] ${
							won
								? "text-[#2EFF0C]"
								: lost
									? "text-[#8C8F8F]"
									: "text-[#E8C547]"
						}`}
						style={{ transform: "rotate(360deg)" }}
					>
						{statusLabel(selection.status).toUpperCase()}
					</span>
				</div>

				<div className="min-w-0 flex-1 px-4 py-3">
					<p className="line-clamp-2 break-words text-[#B5B7B5] text-xs underline decoration-[#B5B7B5]/40">
						{displayMatchName(selection.match)}
					</p>

					<div className="mt-3 space-y-1 text-sm">
						{selectionDetailRow("Market:", selection.market ?? "—")}
						{selectionDetailRow("Result:", selection.result ?? "—")}
						{selectionDetailRow("Pick:", selection.pick ?? "—")}
						{selectionDetailRow("Odds:", selection.odds ?? "—")}
					</div>

					<button
						type="button"
						className="mt-3 w-full cursor-not-allowed rounded-lg bg-[#1C1D1F] py-2 text-[#6B6E6C] text-xs"
						disabled
					>
						Match Results
					</button>
				</div>
			</div>
		</div>
	);
}

// Pending card for mobile
function PendingSelectionCard({ selection }: { selection: BetSelection }) {
	const notStarted = hasNotStarted(selection.startTime);

	return (
		<div className="relative overflow-hidden rounded-2xl border border-[#2A3A24] bg-[#0A0A0A] px-4 py-3">
			<div className="flex min-w-0 items-start justify-between gap-2 text-sm">
				<span className="min-w-0 flex-1 break-words text-white">
					{displayMatchName(selection.match)}
				</span>
				<span className="shrink-0 text-[#8C8F8F] text-xs">
					{formatKickoff(selection.startTime)}
				</span>
			</div>

			<div className="mt-1 flex items-start justify-between gap-2">
				<span className="min-w-0 flex-1 break-words font-semibold text-white">
					{selection.pick ?? "—"}
				</span>
				<span className="shrink-0 font-semibold text-white">
					{selection.odds ?? "—"}
				</span>
			</div>

			<div className="mt-1 text-[#6B6E6C] text-xs">
				{selection.market ?? "—"}
			</div>

			{notStarted && (
				<span className="pointer-events-none absolute inset-0 flex items-center justify-end pr-4 font-black text-2xl text-[#3A3A3A] tracking-tight">
					NOT START
				</span>
			)}
		</div>
	);
}

/** Casino Selection Card */
function CasinoSelectionCard({ selection }: { selection: CasinoSelection }) {
	const won = selection.status === "won";
	const lost = selection.status === "lost";

	return (
		<div
			className={`relative overflow-hidden rounded-2xl border ${
				won
					? "border-[#1F4D2C] bg-[#0A1A0E]"
					: lost
						? "border-[#1C1D1F] bg-[#0A0A0A]"
						: "border-[#3A3312] bg-[#14120A]"
			}`}
		>
			<div className="flex">
				<div
					className={`flex w-8 shrink-0 flex-col items-center gap-2 pt-3 pb-2 ${
						won ? "bg-[#123018]" : lost ? "bg-[#1A1A1A]" : "bg-[#3A3312]"
					}`}
				>
					{won && <Trophy className="h-4 w-4 text-[#E8A93D]" fill="#E8A93D" />}
					{!won && (
						<span className="mt-0.5 h-2 w-2 rounded-full bg-[#8C8F8F]" />
					)}
					<span
						className={`text-center font-bold text-xs tracking-wide [writing-mode:vertical-rl] ${
							won
								? "text-[#2EFF0C]"
								: lost
									? "text-[#8C8F8F]"
									: "text-[#E8C547]"
						}`}
						style={{ transform: "rotate(360deg)" }}
					>
						{statusLabel(selection.status).toUpperCase()}
					</span>
				</div>

				<div className="min-w-0 flex-1 px-4 py-3">
					<div className="flex min-w-0 items-start justify-between gap-2 text-xs">
						<span className="min-w-0 flex-1 break-words text-[#8C8F8F]">
							{selection.gameName}
						</span>
						<span className="shrink-0 text-[#B5B7B5]">{selection.type}</span>
					</div>

					<div className="mt-3 space-y-1 text-sm">
						{selectionDetailRow("Amount:", formatMoney(selection.amount))}
						{selection.provider &&
							selectionDetailRow("Provider:", selection.provider)}
						{selection.roundId &&
							selectionDetailRow(
								"Round ID:",
								<span className="text-xs">{selection.roundId}</span>,
							)}
					</div>
				</div>
			</div>
		</div>
	);
}

function TicketDetailsPage() {
	const navigate = useNavigate();
	const { ticketId } = useParams({ from: "/bet-history/$ticketId" });

	const {
		data: ticket,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["ticket-detail", ticketId],
		queryFn: () => fetchTicketDetail(ticketId),
	});

	if (isLoading) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center text-[#6B6E6C]">
				Loading ticket…
			</div>
		);
	}

	if (isError || !ticket) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center text-[#F0668A]">
				Couldn't load this ticket. Try again.
			</div>
		);
	}

	const isWon = ticket.outcome === "won";
	const isPending = ticket.outcome === "pending";
	const isCasino = ticket.isCasino || false;

	const shortenTicketId = (ticketId: string) => {
		return ticketId.length > 8
			? `${ticketId.slice(0, 5)}...${ticketId.slice(-3)}`
			: ticketId;
	};

	const handleCopyTicketId = () => {
		navigator.clipboard.writeText(ticket.ticketId);
		toast.success("Ticket ID copied");
	};

	const bannerGradient = isWon
		? "bg-gradient-to-b from-[#105904] via-[#04100B] to-[#000606]"
		: isPending
			? "bg-gradient-to-b from-[#A88620] via-[#04100B] to-[#000606]"
			: "bg-gradient-to-b from-[#5A5F63] via-[#04100B] to-[#000606]";

	return (
		<div className="min-h-screen bg-background text-white">
			<div className="flex items-center gap-3 px-4 py-4 sm:px-0">
				<button
					type="button"
					onClick={() => navigate({ to: "/bet-history" })}
					aria-label="Back to bet history"
					className="flex h-9 w-9 items-center justify-center text-white"
				>
					<ChevronLeft className="h-6 w-6" />
				</button>
				<h1 className="font-bold text-white text-xl">Ticket Details</h1>
			</div>

			<div className="mx-auto max-w-2xl px-4 pb-8 lg:container sm:px-0 md:max-w-none md:px-0 lg:mx-auto">
				<div
					className={`relative overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-8 ${bannerGradient}`}
				>
					<div className="flex items-center justify-between text-[#B5B7B5] text-xs sm:text-sm">
						<span>
							{ticket.dateTime} &nbsp;
							<span className="text-white">{ticket.betType}</span>
						</span>

						<span className="flex items-center gap-1.5 text-white">
							Ticket ID: {shortenTicketId(ticket.ticketId)}
							<button
								type="button"
								onClick={handleCopyTicketId}
								aria-label="Copy ticket ID"
								className="hover:opacity-80"
							>
								<Copy className="h-3.5 w-3.5" />
							</button>
						</span>
					</div>

					<div className="mt-5 flex flex-col items-center justify-center gap-2 sm:mt-6">
						{isWon && (
							<div className="flex items-center gap-2">
								<span className="font-bold text-3xl text-[#2EFF0C] tracking-wide">
									WON
								</span>
								<Trophy className="h-8 w-8 text-[#FF9500]" fill="#FF9500" />
							</div>
						)}
						{isPending && (
							<span className="font-bold text-3xl text-[#FFD70F] tracking-wide">
								PENDING
							</span>
						)}
						{!isWon && !isPending && (
							<span className="font-bold text-3xl text-[#B0B0B0] tracking-wide">
								LOST
							</span>
						)}
					</div>

					<div className="mt-5 space-y-2 text-sm sm:mt-6">
						<div className="flex items-center justify-between">
							<span className="text-[#FFFFFF]">Stake amount</span>
							<span className="font-semibold text-white">
								{formatMoney(ticket.stake)}
							</span>
						</div>
						{!isCasino && (
							<div className="flex items-center justify-between">
								<span className="text-[#FFFFFF]">Total Odds</span>
								<span className="font-semibold text-white">
									{ticket.totalOdds.toFixed(2)}
								</span>
							</div>
						)}
						{isCasino && ticket.multiplier && (
							<div className="flex items-center justify-between">
								<span className="text-[#FFFFFF]">Multiplier</span>
								<span className="font-semibold text-white">
									{ticket.multiplier.toFixed(2)}x
								</span>
							</div>
						)}
						{isWon && ticket.totalReturn !== null && (
							<div className="flex items-center justify-between">
								<span className="text-[#FFFFFF]">Total Return</span>
								<span className="font-semibold text-[#2EFF0C]">
									{formatMoney(ticket.totalReturn)}
								</span>
							</div>
						)}
						{isPending && ticket.potentialCashout !== null && (
							<div className="flex items-center justify-between">
								<span className="text-[#FFFFFF]">Potential Cashout</span>
								<span className="font-semibold text-white">
									{formatMoney(ticket.potentialCashout)}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* DESKTOP: table view for sportsbook */}
				{!isCasino && ticket.selections && ticket.selections.length > 0 && (
					<div className="mt-4 hidden overflow-hidden rounded-2xl border border-[#1C1D1F] md:block">
						<div className="overflow-x-auto">
							<table className="w-full min-w-[720px] border-collapse text-left">
								<thead>
									<tr className="border-[#1C1D1F] border-b text-[#6B6E6C] text-xs uppercase tracking-wide">
										<th className="px-4 py-3 font-medium">Match</th>
										<th className="px-4 py-3 font-medium">Market</th>
										<th className="px-4 py-3 font-medium">Result</th>
										<th className="px-4 py-3 font-medium">Pick</th>
										<th className="px-4 py-3 font-medium">Odds</th>
										<th className="px-4 py-3 font-medium">Status</th>
										<th className="px-4 py-3 font-medium" />
									</tr>
								</thead>
								<tbody>
									{ticket.selections.map((sel, index) => (
										<tr
											key={sel.matchId ?? index}
											className={`border-[#1C1D1F] border-b last:border-none ${
												isWon
													? index % 2 === 0
														? "bg-[#0F1A13]"
														: "bg-transparent"
													: "bg-transparent"
											}`}
										>
											<td className="px-4 py-3 text-sm text-white">
												{displayMatchName(sel.match)}
											</td>
											<td className="px-4 py-3 text-sm text-white">
												{sel.market ?? "—"}
											</td>
											<td className="px-4 py-3 text-[#8C8F8F] text-sm">
												{sel.result ?? "—"}
											</td>
											<td className="px-4 py-3 text-sm text-white">
												{sel.pick ?? "—"}
											</td>
											<td className="px-4 py-3 text-sm text-white">
												{sel.odds ?? "—"}
											</td>
											<td className="px-4 py-3">
												<span
													className={`inline-flex rounded-full px-3 py-1 font-medium text-xs ${statusBadgeClass(sel.status)}`}
												>
													{statusLabel(sel.status)}
												</span>
											</td>
											<td className="px-4 py-3 text-[#6B6E6C]">
												<ChevronRight className="h-4 w-4" />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* Casino Summary Section */}
				{isCasino && (
					<div className="mt-4 overflow-hidden rounded-2xl border border-[#1C1D1F] bg-[#0A0A0A] p-4">
						<h3 className="mb-3 font-semibold text-sm text-white">
							Game Details
						</h3>
						<div className="space-y-2 text-sm">
							{ticket.gameName && (
								<div className="flex justify-between">
									<span className="text-[#8C8F8F]">Game</span>
									<span className="text-white">{ticket.gameName}</span>
								</div>
							)}
							{ticket.provider && (
								<div className="flex justify-between">
									<span className="text-[#8C8F8F]">Provider</span>
									<span className="text-white">{ticket.provider}</span>
								</div>
							)}
							{ticket.roundId && (
								<div className="flex justify-between">
									<span className="text-[#8C8F8F]">Round ID</span>
									<span className="truncate text-white text-xs">
										{ticket.roundId}
									</span>
								</div>
							)}
							{ticket.multiplier && (
								<div className="flex justify-between">
									<span className="text-[#8C8F8F]">Multiplier</span>
									<span className="text-white">
										{ticket.multiplier.toFixed(2)}x
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				{/* MOBILE: vertical strip cards */}
				<div className="mt-4 space-y-3 md:hidden">
					{isCasino && ticket.casinoSelections
						? ticket.casinoSelections.map((sel, index) => (
								<CasinoSelectionCard key={sel.id ?? index} selection={sel} />
							))
						: ticket.selections?.map((sel, index) => {
								// Use pending card style for pending selections
								if (sel.status === "pending") {
									return (
										<PendingSelectionCard
											key={sel.matchId ?? index}
											selection={sel}
										/>
									);
								}
								return (
									<SelectionCard key={sel.matchId ?? index} selection={sel} />
								);
							})}
				</div>

				{/* CASH OUT BUTTON - only for pending tickets */}
				{isPending && (
					<div className="mt-6 px-2 py-4 md:rounded-2xl md:border md:border-[#1C1D1F] md:bg-[#0A0A0A] md:p-4">
						<div className="flex items-center gap-4 md:justify-between">
							<div className="hidden md:block">
								<span className="text-[#6B6E6C] text-sm">Cashout</span>
								<div className="font-bold text-white text-xl">
									₦{formatMoney(ticket.potentialCashout || 0)}
								</div>
							</div>
							<RefreshCcw
								className="h-6 w-6 shrink-0 text-[#00BD61] md:hidden"
								strokeWidth={3}
							/>
							<button
								type="button"
								disabled
								className="h-11 flex-1 cursor-not-allowed rounded-full border border-[#B68B2B] bg-transparent px-6 py-2 font-bold text-[#FFC900] text-sm md:flex-none md:border-0 md:bg-[#FF8A4C] md:font-semibold md:text-white md:opacity-60 md:transition-opacity md:hover:opacity-80"
								title="Cash out is not yet available"
							>
								Cashout&nbsp;&nbsp;{formatMoney(ticket.potentialCashout || 0)}
							</button>
						</div>
					</div>
				)}

				{/* Footer */}
				<div className="mt-4 divide-y divide-[#1C1D1F] rounded-2xl border border-[#1C1D1F]">
					<div className="flex items-center justify-between px-5 py-4">
						<span className="text-[#B5B7B5] text-sm">
							Number of Bets: {ticket.numberOfBets}
						</span>
					</div>
					<div className="flex items-center justify-between px-5 py-4">
						<button
							type="button"
							onClick={() => navigate({ to: "/bet-history" })}
							aria-label="Back to bet history"
							className="cursor-pointer text-[#B5B7B5] text-sm hover:text-white"
						>
							Check Transaction History
						</button>
						<span className="text-[#6B6E6C]">&gt;</span>
					</div>
				</div>
			</div>
		</div>
	);
}
