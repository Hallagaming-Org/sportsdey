import { useState, useEffect } from "react";
import { Receipt } from "lucide-react";

export function CustomBetslipFloatingButton({ isOpen }: { isOpen: boolean }) {
	const [itemCount, setItemCount] = useState(0);
	const [totalOdds, setTotalOdds] = useState(0);

	useEffect(() => {
		const updateState = () => {
			try {
				const betslipData = localStorage.getItem("Betslip");
				if (betslipData) {
					const parsed = JSON.parse(betslipData);
					const selections = parsed.state?.selectionOdds || [];
					setItemCount(selections.length);
					setTotalOdds(parsed.state?.totalOdds || 0);
				}
			} catch (e) {
				console.error("Failed to parse Betslip from localStorage", e);
			}
		};

		// Initial check
		updateState();

		// Check every 500ms for changes
		const interval = setInterval(updateState, 500);
		return () => clearInterval(interval);
	}, []);

	if (isOpen) return null;

	return (
		<button
			type="button"
			aria-label="Open bet basket"
			onClick={() => {
				document.dispatchEvent(new CustomEvent("toggle-local-betslip"));
			}}
			className="fixed right-4 bottom-24 z-[999999] flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-xl transition-transform hover:scale-105 lg:hidden"
		>
			<div className="relative flex flex-col items-center justify-center">
				{itemCount > 0 ? (
					<>
						<span className="font-bold text-sm leading-tight">
							{totalOdds > 0 ? totalOdds.toFixed(2) : ""}
						</span>
						<div className="absolute -right-2 -top-4 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
							{itemCount}
						</div>
					</>
				) : (
					<>
						<Receipt className="h-6 w-6" />
						<div className="absolute -right-2 -top-4 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
							0
						</div>
					</>
				)}
			</div>
		</button>
	);
}
