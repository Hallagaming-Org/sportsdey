import { useCallback, useEffect, useState } from "react";
import {
	SPORTSBOOK_BETSLIP_ID,
	type ToggleWidgetBetslipPayload,
} from "@/lib/sportsbook";

type BetslipStyleInput = Pick<
	ToggleWidgetBetslipPayload,
	"breakpoint" | "isOpen"
>;

const betslipStyleGetter: Record<
	"static" | "island",
	(data: BetslipStyleInput) => string
> = {
	static: ({ isOpen, breakpoint }: BetslipStyleInput): string => {
		if (breakpoint === "mobile") {
			if (isOpen) {
				document.body.classList.add("overflow-hidden");
				return "fixed bottom-0 left-0 top-0 z-50 lg:hidden w-full h-full bg-background/95 backdrop-blur-sm transition-all";
			}
			document.body.classList.remove("overflow-hidden");
			return "fixed bottom-[56px] left-0 z-40 w-full translate-y-full pointer-events-none opacity-0 transition-all";
		}
		if (breakpoint === "tablet") {
			return `fixed top-0 right-0 z-50 h-[100vh] w-[320px] bg-background shadow-2xl ${isOpen ? "translate-x-0" : "translate-x-full"} transition-transform`;
		}
		return "sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto";
	},
	island: ({ isOpen, breakpoint }: BetslipStyleInput): string => {
		if (breakpoint === "mobile") {
			if (isOpen) {
				document.body.classList.add("overflow-hidden");
				return "fixed bottom-0 left-0 top-0 z-50 lg:hidden w-full h-full max-h-full bg-background/95 backdrop-blur-sm transition-all";
			}
			document.body.classList.remove("overflow-hidden");
			return "fixed bottom-[56px] left-0 z-40 w-full translate-y-full pointer-events-none opacity-0 transition-all";
		}
		if (breakpoint === "tablet") {
			return `fixed top-0 right-0 z-50 h-[100vh] w-[320px] bg-background shadow-2xl ${isOpen ? "translate-x-0" : "translate-x-full"} transition-transform`;
		}
		return "fixed inset-x-1/2 bottom-0 z-[999999] w-full max-w-[320px] max-h-[80vh] -translate-x-1/2";
	},
};

export function SportsbookBetslip() {
	const [state, setState] = useState<ToggleWidgetBetslipPayload | undefined>();

	const initBetting = useCallback(() => {
		if (!window.bettingAPI) return;
		window.bettingAPI.subscribe("toggle-widget-betslip", setState);
	}, []);

	useEffect(() => {
		if (window.bettingAPI) {
			initBetting();
		}
		document.addEventListener("betting-init", initBetting);
		return () => {
			document.removeEventListener("betting-init", initBetting);
			document.body.classList.remove("overflow-hidden");
		};
	}, [initBetting]);

	const getter = state
		? betslipStyleGetter[state.widgetType] || betslipStyleGetter.static
		: undefined;
	const className =
		state && getter
			? getter({ isOpen: state.isOpen, breakpoint: state.breakpoint })
			: "";

	return <div id={SPORTSBOOK_BETSLIP_ID} className={className} />;
}
