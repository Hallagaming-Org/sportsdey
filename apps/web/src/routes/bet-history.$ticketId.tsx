import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import Trophy from "@/logos/trophy.svg?react";

export const Route = createFileRoute("/bet-history/$ticketId")({
	component: TicketDetailsPage,
});

type SelectionStatus = "won" | "lost" | "pending";
type TicketOutcome = "won" | "lost" | "pending";

type BetSelection = {
	id: string;
	dateTime: string;
	league: string;
	homeTeam: string;
	awayTeam: string;
	homeScore: number;
	awayScore: number;
	matchStatus: string;
	market: string;
	result: string;
	pick: string;
	status: SelectionStatus;
};

type TicketDetail = {
	ticketId: string;
	dateTime: string;
	betType: string;
	outcome: TicketOutcome;
	stake: number;
	totalOdds: number;
	totalReturn?: number;
	potentialCashout?: number;
	numberOfBets: number;
	selections: BetSelection[];
};



const MOCK_TICKETS: Record<string, TicketDetail> = {
	"12345-won": {
		ticketId: "12345",
		dateTime: "08/08 - 13:17",
		betType: "Multiple",
		outcome: "won",
		stake: 100,
		totalOdds: 7.32,
		totalReturn: 1741.3,
		numberOfBets: 8,
		selections: Array.from({ length: 8 }, (_, i) => ({
			id: `sel-${i}`,
			dateTime: "Aug 8, 2025 10:42 pm",
			league: "International Champions",
			homeTeam: "Kortrijk",
			awayTeam: "Gent",
			homeScore: 4,
			awayScore: 0,
			matchStatus: "FT",
			market: i % 2 === 0 ? "1×2" : "Over/under",
			result: i % 2 === 0 ? "Home" : "Under 2.5",
			pick: i % 2 === 0 ? "Away @1.32" : "Over 2.5 @1.44",
			status: "won" as const,
		})),
	},
	"12345-lost": {
		ticketId: "12345",
		dateTime: "08/08 - 13:17",
		betType: "Multiple",
		outcome: "lost",
		stake: 100,
		totalOdds: 7.32,
		numberOfBets: 4,
		selections: [
			{
				id: "sel-0",
				dateTime: "08/08 - 13:17",
				league: "International Club-Friendly Game",
				homeTeam: "Kortrijk",
				awayTeam: "Gent",
				homeScore: 0,
				awayScore: 1,
				matchStatus: "FT",
				market: "(Over/Under)",
				result: "Under 1.5",
				pick: "Over 1.5 @1.18",
				status: "lost",
			},
			{
				id: "sel-1",
				dateTime: "08/08 - 13:17",
				league: "International Club-Friendly Game",
				homeTeam: "St. Gallen",
				awayTeam: "Young Boys",
				homeScore: 4,
				awayScore: 0,
				matchStatus: "FT",
				market: "(Over/Under)",
				result: "Over 2.5",
				pick: "Over 2.5 @1.46",
				status: "won",
			},
			{
				id: "sel-2",
				dateTime: "08/08 - 13:17",
				league: "International Club-Friendly Game",
				homeTeam: "Kortrijk",
				awayTeam: "Gent",
				homeScore: 0,
				awayScore: 1,
				matchStatus: "FT",
				market: "(Over/Under)",
				result: "Under 1.5",
				pick: "Over 1.5 @1.18",
				status: "lost",
			},
			{
				id: "sel-3",
				dateTime: "08/08 - 13:17",
				league: "International Club-Friendly Game",
				homeTeam: "St. Gallen",
				awayTeam: "Young Boys",
				homeScore: 4,
				awayScore: 0,
				matchStatus: "FT",
				market: "(Over/Under)",
				result: "Over 2.5",
				pick: "Over 2.5 @1.46",
				status: "won",
			},
		],
	},
	"12345-pending": {
		ticketId: "12345",
		dateTime: "08/08 - 13:17",
		betType: "Multiple",
		outcome: "pending",
		stake: 100,
		totalOdds: 7.32,
		potentialCashout: 1732.0,
		numberOfBets: 8,
		selections: Array.from({ length: 8 }, (_, i) => ({
			id: `sel-${i}`,
			dateTime: "Aug 8, 2025 10:42 pm",
			league: "International Champions",
			homeTeam: "Kortrijk",
			awayTeam: "Gent",
			homeScore: 4,
			awayScore: 0,
			matchStatus: "FT",
			market: i % 2 === 0 ? "1×2" : "Over/under",
			result: i % 2 === 0 ? "Home" : "Under 2.5",
			pick: i % 2 === 0 ? "Away @1.32" : "Over 2.5 @1.44",
			status: i % 2 === 0 ? ("won" as const) : ("lost" as const),
		})),
	},
};

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
					{!won && <span className="mt-0.5 h-2 w-2 rounded-full bg-[#8C8F8F]" />}
					<span
						className={`font-bold text-xs text-center tracking-wide [writing-mode:vertical-rl] ${
							won ? "text-[#2EFF0C]" : lost ? "text-[#8C8F8F]" : "text-[#E8C547]"
						}`}
						style={{ transform: "rotate(360deg)" }}
					>
						{statusLabel(selection.status).toUpperCase()}
					</span>
				</div>

				<div className="flex-1 px-4 py-3">
					<div className="flex items-center justify-between text-xs">
						<span className="text-[#8C8F8F]">{selection.dateTime}</span>
						<span className="truncate text-[#B5B7B5] underline decoration-[#B5B7B5]/40">
							{selection.league}
						</span>
					</div>

					<div className="mt-3 grid grid-cols-[1fr_40px_32px] items-center gap-1 text-sm">
						<span className="text-white">{selection.homeTeam}</span>
						<span />
						<span className="text-right text-white">{selection.homeScore}</span>

						<span className="text-white">{selection.awayTeam}</span>
						<span className="text-center text-[10px] text-[#6B6E6C]">
							{selection.matchStatus}
						</span>
						<span className="text-right text-white">{selection.awayScore}</span>
					</div>

					<div className="mt-3 space-y-1 text-sm">
						<div className="flex justify-between">
							<span className="text-[#8C8F8F]">Market:</span>
							<span className="text-white">{selection.market}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-[#8C8F8F]">Result:</span>
							<span className="text-white">{selection.result}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-[#8C8F8F]">Pick:</span>
							<span className="text-white">{selection.pick}</span>
						</div>
					</div>

					{/* wire up destination */}
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

function TicketDetailsPage() {
	const navigate = useNavigate();
	const { ticketId } = useParams({ from: "/bet-history/$ticketId" });

	const ticket = MOCK_TICKETS[ticketId] ?? MOCK_TICKETS["12345-won"];
	const isWon = ticket.outcome === "won";
	const isPending = ticket.outcome === "pending";

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
				<h1 className="font-bold text-xl text-white">Ticket Details</h1>
			</div>

			<div className="mx-auto max-w-2xl px-4 pb-8 sm:px-0 md:max-w-none md:px-0 lg:container lg:mx-auto">
				<div className={`relative overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-8 ${bannerGradient}`}>
					<div className="flex items-center justify-between text-[#B5B7B5] text-xs sm:text-sm">
						<span>
							{ticket.dateTime} &nbsp;
							<span className="text-white">{ticket.betType}</span>
						</span>
						<span className="flex text-white  items-center gap-1.5">
							Ticket ID: {ticket.ticketId}
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
							<span className="font-semibold text-white">{formatMoney(ticket.stake)}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-[#FFFFFF]">Total Odds</span>
							<span className="font-semibold text-white">{ticket.totalOdds.toFixed(2)}</span>
						</div>
						{isWon && ticket.totalReturn !== undefined && (
							<div className="flex items-center justify-between">
								<span className="text-[#FFFFFF]">Total Return</span>
								<span className="font-semibold text-[#2EFF0C]">
									{formatMoney(ticket.totalReturn)}
								</span>
							</div>
						)}
						{isPending && ticket.potentialCashout !== undefined && (
							<div className="flex items-center justify-between">
								<span className="text-[#FFFFFF]">Potential Cashout</span>
								<span className="font-semibold text-white">
									{formatMoney(ticket.potentialCashout)}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* DESKTOP: table view  */}
				<div className="mt-4 hidden overflow-hidden rounded-2xl border border-[#1C1D1F] md:block">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[720px] border-collapse text-left">
							<thead>
								<tr className="border-[#1C1D1F] border-b text-[#6B6E6C] text-xs uppercase tracking-wide">
									<th className="px-4 py-3 font-medium">Date &amp; Time</th>
									<th className="px-4 py-3 font-medium">League</th>
									<th className="px-4 py-3 font-medium">Match</th>
									<th className="px-4 py-3 font-medium">Score</th>
									<th className="px-4 py-3 font-medium">Market</th>
									<th className="px-4 py-3 font-medium">Result</th>
									<th className="px-4 py-3 font-medium">Pick</th>
									<th className="px-4 py-3 font-medium">Status</th>
									<th className="px-4 py-3 font-medium" />
								</tr>
							</thead>
							<tbody>
								{ticket.selections.map((sel, index) => (
									<tr
										key={sel.id}
										className={`border-[#1C1D1F] border-b last:border-none ${
											isWon ? (index % 2 === 0 ? "bg-[#0F1A13]" : "bg-transparent") : "bg-transparent"
										}`}
									>
										<td className="px-4 py-3 text-[#FFFFFF] text-sm">{sel.dateTime}</td>
										<td className="px-4 py-3 text-[#8C8F8F] text-sm">{sel.league}</td>
										<td className="px-4 py-3 text-white text-sm">
											{sel.homeTeam} {sel.awayTeam}          
										</td>
										<td className="px-4 py-3 text-white text-sm">
											{sel.homeScore} {sel.awayScore}
										</td>
										<td className="px-4 py-3 text-white text-sm">{sel.market}</td>
										<td className="px-4 py-3 text-[#8C8F8F] text-sm">{sel.result}</td>
										<td className="px-4 py-3 text-white text-sm">{sel.pick}</td>
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

				{/* MOBILE: vertical strip cards */}
				<div className="mt-4 space-y-3 md:hidden">
					{ticket.selections.map((sel) => (
						<SelectionCard key={sel.id} selection={sel} />
					))}
				</div>

				{/* Footer  */}
				<div className="mt-4 divide-y divide-[#1C1D1F] rounded-2xl border border-[#1C1D1F]">
					<div className="flex items-center justify-between px-5 py-4">
						<span className="text-[#B5B7B5] text-sm">
							Number of Bets: {ticket.numberOfBets}
						</span>
						<button type="button" className="text-accent text-sm hover:opacity-80">
							Bet Details &gt;
						</button>
					</div>
					<div className="flex items-center justify-between px-5 py-4">
						<button type="button" className="text-[#B5B7B5] text-sm hover:text-white">
							Check Transaction History
						</button>
						<span className="text-[#6B6E6C]">&gt;</span>
					</div>
				</div>
			</div>
		</div>
	);
}