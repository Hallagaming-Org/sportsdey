import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	TransactionReceipt,
	type ReceiptDetail,
} from "@/components/transaction-receipt";

export const Route = createFileRoute("/receipt-preview")({
	component: ReceiptPreviewPage,
});

type ReceiptType = "transfer" | "bill" | "deposit" | "withdraw";

const mockData: Record<ReceiptType, ReceiptDetail[]> = {
	transfer: [
		{ label: "From", value: "John Samuel (****456)" },
		{ label: "To", value: "Adebambo BIG\nOpay (****980)" },
		{ label: "Amount", value: "₦2,500" },
		{ label: "Fee", value: "₦0" },
		{ label: "Date", value: "Aug 6, 2025, 09:13" },
		{ label: "Transaction Type", value: "Outward Transfer" },
		{ label: "Transaction ID", value: "0123456789", copyable: true },
	],
	bill: [
		{ label: "From", value: "John Samuel (****456)" },
		{ label: "To", value: "07061884345 (MTN NG)" },
		{ label: "Amount", value: "- ₦1,500" },
		{ label: "Fee", value: "₦0" },
		{ label: "Description", value: "3.2GB FOR 2 DAYS Purchase" },
		{ label: "Date", value: "Aug 6, 2025, 09:13" },
		{ label: "Transaction Type", value: "Bills (Power & Internet)" },
		{ label: "Transaction ID", value: "0123456789", copyable: true },
	],
	deposit: [
		{ label: "Transaction Type", value: "Credit (Deposit)" },
		{ label: "Amount", value: "₦15,000" },
		{ label: "Fee", value: "₦0" },
		{ label: "Date", value: "Aug 6, 2025, 09:13" },
		{ label: "Transaction ID", value: "0123456789", copyable: true },
	],
	withdraw: [
		{ label: "Transaction Type", value: "Debit (Withdrawal)" },
		{ label: "Amount", value: "- ₦15,000" },
		{ label: "Fee", value: "₦0" },
		{ label: "Date", value: "Aug 6, 2025, 09:13" },
		{ label: "Transaction ID", value: "0123456789", copyable: true },
	],
};

function ReceiptPreviewPage() {
	const [activeType, setActiveType] = useState<ReceiptType>("transfer");

	const handleShare = () => {
		alert(`Sharing ${activeType} receipt...`);
	};

	return (
		<div className="flex min-h-screen flex-col md:flex-row bg-[#050A08]">
			{/* Mockup controls - Only visible on larger screens or pushed to top */}
			<div className="border-r border-[#1A221E] bg-[#0A120E] p-6 text-white md:w-64 shrink-0">
				<h2 className="mb-4 font-bold text-lg">Mock Controls</h2>
				<p className="mb-6 text-sm text-[#8C8F8F]">
					Select a receipt type to preview:
				</p>
				<div className="flex flex-col gap-3">
					{(["transfer", "bill", "deposit", "withdraw"] as ReceiptType[]).map(
						(type) => (
							<button
								key={type}
								type="button"
								onClick={() => setActiveType(type)}
								className={`cursor-pointer rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
									activeType === type
										? "bg-[#00D600] text-white"
										: "bg-[#1A221E] text-[#8C8F8F] hover:bg-[#25302A] hover:text-white"
								}`}
							>
								{type.charAt(0).toUpperCase() + type.slice(1)} Receipt
							</button>
						),
					)}
				</div>
			</div>

			{/* Actual Component Preview */}
			<div className="flex-1 overflow-y-auto relative bg-[#050A08]">
				{/* Mobile preview frame */}
				<div className="mx-auto my-10 max-w-sm rounded-[2.5rem] border-[8px] border-[#1A221E] overflow-hidden shadow-2xl">
					<TransactionReceipt
						details={mockData[activeType]}
						onBack={() => alert("Back button clicked")}
						onShare={handleShare}
					/>
				</div>
			</div>
		</div>
	);
}
