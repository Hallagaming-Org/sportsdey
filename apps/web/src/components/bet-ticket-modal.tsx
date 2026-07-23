import { Copy, Wallet, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export type BetTicketDetails = {
	id: string;
	ticketId: string;
	type: string;
	amount: number;
	multiplier: number;
	status: "success" | "pending" | "failed";
	placedAt: string;
	settledAt?: string;
	potentialWin?: number;
	actualPayout?: number;
	totalOdds?: string;
};

interface Props {
	bet: BetTicketDetails | null;
	onClose: () => void;
}

function formatMoney(value?: number) {
	if (value === undefined || value === null) return "N/A";
	return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function formatDate(dateString?: string) {
	if (!dateString) return "N/A";
	try {
		const formatted = new Date(dateString).toLocaleString("en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		});
		return formatted.replace(" AM", " am").replace(" PM", " pm");
	} catch {
		return dateString;
	}
}

function getStatusBadge(status: BetTicketDetails["status"]) {
	if (status === "success") {
		return (
			<span className="inline-flex items-center rounded-full border border-[#BFF0D4] bg-[#E8F8EE] px-3.5 py-1 text-sm font-semibold text-[#1E9E24]">
				Success
			</span>
		);
	}
	if (status === "pending") {
		return (
			<span className="inline-flex items-center rounded-full border border-[#F5E7B7] bg-[#FCF8E3] px-3.5 py-1 text-sm font-semibold text-[#B89020]">
				Pending
			</span>
		);
	}
	return (
		<span className="inline-flex items-center rounded-full border border-[#FCA5A5] bg-[#FEE2E2] px-3.5 py-1 text-sm font-semibold text-[#DC2626]">
			Failed
		</span>
	);
}

export function BetTicketModal({ bet, onClose }: Props) {
	if (!bet) return null;

	const handleCopy = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	};

	const handleDownloadReceipt = () => {
		const doc = new jsPDF();
		doc.setFontSize(16);
		doc.text("BET RECEIPT", 14, 20);
		doc.setFontSize(10);
		doc.setTextColor(100);
		doc.text(`Ticket ID: ${bet.ticketId}`, 14, 28);
		doc.text(`Date & Time: ${formatDate(bet.placedAt)}`, 14, 34);

		const rows = [
			["Ticket ID", bet.ticketId],
			["Type", bet.type],
			["Status", bet.status.toUpperCase()],
			["Stake", formatMoney(bet.amount)],
			["Multiplier", `${bet.multiplier.toFixed(2)}x`],
			["Total Odds", bet.totalOdds ?? "N/A"],
			["Potential Win", formatMoney(bet.potentialWin)],
			["Actual Payout", formatMoney(bet.actualPayout)],
			["Placed On", formatDate(bet.placedAt)],
			["Settled On", bet.settledAt ? formatDate(bet.settledAt) : "N/A"],
		];

		autoTable(doc, {
			head: [["Field", "Details"]],
			body: rows,
			startY: 40,
			theme: "striped",
			headStyles: { fillColor: [3, 2, 41] },
		});

		doc.save(`Receipt_${bet.ticketId}.pdf`);
		toast.success("Receipt downloaded successfully");
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
			<div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-[22px] bg-[#F8F9FC] shadow-[0_30px_60px_rgba(11,20,48,0.18)]">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5">
					<div className="flex items-center gap-3">
						<div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F8EE] text-[#1E9E24]">
							<Wallet className="h-5 w-5" />
						</div>
						<h3 className="text-[18px] font-bold text-[#030229]">
							Transaction Info
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#030229] text-white transition-opacity hover:opacity-90"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Body */}
				<div className="min-h-0 flex-1 overflow-y-auto p-6">
					<div className="space-y-4 rounded-[18px] border border-gray-100 bg-white p-5 shadow-sm">
						<div className="flex items-center justify-between text-sm">
							<span className="shrink-0 text-[#82869A]">Ticket ID:</span>
							<span className="flex items-center gap-1.5 font-mono text-xs font-medium text-[#030229]">
								{bet.ticketId}
								<button
									type="button"
									onClick={() => handleCopy(bet.ticketId, "Ticket ID")}
									className="cursor-pointer transition-opacity hover:opacity-80"
									title="Copy Ticket ID"
								>
									<Copy className="h-3.5 w-3.5 text-[#1E9E24]" />
								</button>
							</span>
						</div>

						<div className="flex items-center justify-between text-sm">
							<span className="shrink-0 text-[#82869A]">Type:</span>
							<span className="font-semibold text-[#030229]">{bet.type}</span>
						</div>

						<div className="flex items-center justify-between text-sm">
							<span className="shrink-0 text-[#82869A]">Status:</span>
							{getStatusBadge(bet.status)}
						</div>

						<div className="flex items-center justify-between text-sm">
							<span className="shrink-0 text-[#82869A]">Stake:</span>
							<span className="text-[15px] font-bold text-[#030229]">
								{formatMoney(bet.amount)}
							</span>
						</div>

						<div className="flex items-center justify-between text-sm">
							<span className="shrink-0 text-[#82869A]">Multiplier:</span>
							<span className="text-[15px] font-bold text-[#030229]">
								{bet.multiplier.toFixed(2)}x
							</span>
						</div>

						{bet.totalOdds && (
							<div className="flex items-center justify-between text-sm">
								<span className="shrink-0 text-[#82869A]">Total Odds:</span>
								<span className="font-medium text-[#030229]">{bet.totalOdds}</span>
							</div>
						)}

						{bet.potentialWin !== undefined && (
							<div className="flex items-center justify-between text-sm">
								<span className="shrink-0 text-[#82869A]">Potential Win:</span>
								<span className="font-medium text-[#030229]">
									{formatMoney(bet.potentialWin)}
								</span>
							</div>
						)}

						{bet.actualPayout !== undefined && (
							<div className="flex items-center justify-between text-sm">
								<span className="shrink-0 text-[#82869A]">Actual Payout:</span>
								<span className="font-medium text-[#030229]">
									{formatMoney(bet.actualPayout)}
								</span>
							</div>
						)}

						<div className="flex items-center justify-between text-sm">
							<span className="shrink-0 text-[#82869A]">Placed On:</span>
							<span className="font-medium text-[#030229]">
								{formatDate(bet.placedAt)}
							</span>
						</div>

						{bet.settledAt && (
							<div className="flex items-center justify-between text-sm">
								<span className="shrink-0 text-[#82869A]">Settled On:</span>
								<span className="font-medium text-[#030229]">
									{formatDate(bet.settledAt)}
								</span>
							</div>
						)}
					</div>

					<button
						type="button"
						onClick={handleDownloadReceipt}
						className="mt-6 w-full cursor-pointer rounded-full bg-[#EEF0F3] py-3.5 text-center text-sm font-bold text-[#030229] transition-colors hover:bg-[#E5E7EB]"
					>
						Download Receipt
					</button>
				</div>
			</div>
		</div>
	);
}