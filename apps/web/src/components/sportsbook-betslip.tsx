// import { useCallback, useEffect, useState } from "react";
// import {
// 	SPORTSBOOK_BETSLIP_ID,
// 	type ToggleWidgetBetslipPayload,
// } from "@/lib/sportsbook";

// type BetslipStyleInput = Pick<
// 	ToggleWidgetBetslipPayload,
// 	"breakpoint" | "isOpen"
// >;

// const betslipStyleGetter: Record<
// 	"static" | "island",
// 	(data: BetslipStyleInput) => string
// > = {
// 	static: ({ isOpen, breakpoint }: BetslipStyleInput): string => {
// 		if (breakpoint === "mobile") {
// 			if (isOpen) {
// 				document.body.classList.add("overflow-hidden");
// 				return "fixed bottom-0 left-0 top-0 z-50 lg:hidden w-full h-full bg-background/95 backdrop-blur-sm transition-all";
// 			}
// 			document.body.classList.remove("overflow-hidden");
// 			return "fixed bottom-[56px] left-0 z-40 w-full translate-y-full pointer-events-none opacity-0 transition-all";
// 		}
// 		if (breakpoint === "tablet") {
// 			return `fixed top-0 right-0 z-50 h-[100vh] w-[320px] bg-background shadow-2xl ${isOpen ? "translate-x-0" : "translate-x-full"} transition-transform`;
// 		}
// 		return "sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto";
// 	},
// 	island: ({ isOpen, breakpoint }: BetslipStyleInput): string => {
// 		if (breakpoint === "mobile") {
// 			if (isOpen) {
// 				document.body.classList.add("overflow-hidden");
// 				return "fixed bottom-0 left-0 top-0 z-50 lg:hidden w-full h-full max-h-full bg-background/95 backdrop-blur-sm transition-all";
// 			}
// 			document.body.classList.remove("overflow-hidden");
// 			return "fixed bottom-[56px] left-0 z-40 w-full translate-y-full pointer-events-none opacity-0 transition-all";
// 		}
// 		if (breakpoint === "tablet") {
// 			return `fixed top-0 right-0 z-50 h-[100vh] w-[320px] bg-background shadow-2xl ${isOpen ? "translate-x-0" : "translate-x-full"} transition-transform`;
// 		}
// 		return "fixed inset-x-1/2 bottom-0 z-[999999] w-full max-w-[320px] max-h-[80vh] -translate-x-1/2";
// 	},
// };

// export function SportsbookBetslip() {
// 	const [state, setState] = useState<ToggleWidgetBetslipPayload | undefined>();

// 	const initBetting = useCallback(() => {
// 		if (!window.bettingAPI) return;
// 		window.bettingAPI.subscribe("toggle-widget-betslip", setState);
// 	}, []);

// 	useEffect(() => {
// 		if (window.bettingAPI) {
// 			initBetting();
// 		}
// 		document.addEventListener("betting-init", initBetting);
// 		return () => {
// 			document.removeEventListener("betting-init", initBetting);
// 			document.body.classList.remove("overflow-hidden");
// 		};
// 	}, [initBetting]);

// 	const getter = state
// 		? betslipStyleGetter[state.widgetType] || betslipStyleGetter.static
// 		: undefined;
// 	const className =
// 		state && getter
// 			? getter({ isOpen: state.isOpen, breakpoint: state.breakpoint })
// 			: "";

// 	return <div id={SPORTSBOOK_BETSLIP_ID} className={className} />;
// }
import { useCallback, useEffect, useRef, useState } from "react";
import {
	SPORTSBOOK_BETSLIP_ID,
	type ToggleWidgetBetslipPayload,
} from "@/lib/sportsbook";

// ─── Layout Constants ─────────────────────────────────────────────────────────
// Adjust BOTTOM_NAV_HEIGHT_PX to match your site's bottom navigation bar height.
const BOTTOM_NAV_HEIGHT_PX = 56;
const HEADER_OFFSET_PX = 64; // must match SPORTSBOOK_HEADER_OFFSET in sportsbook.ts
const BETSLIP_WIDTH_PX = 320;

// ─── Types ────────────────────────────────────────────────────────────────────
type BetslipStyleInput = Pick<ToggleWidgetBetslipPayload, "breakpoint" | "isOpen">;
type StyleResult = { className: string; style: React.CSSProperties };

// ─── Style Getters ────────────────────────────────────────────────────────────
//
// KEY FIX: Each getter now returns BOTH className and an inline style object.
// Tailwind alone can't safely express dynamic pixel values (bottom nav height,
// exact header offset). Mixing the two gives us full control without JIT issues.
//
// All breakpoints are handled here so the betslip div is always positioned
// correctly BEFORE the widget fires toggle-widget-betslip.
//
const betslipStyleGetter: Record<
	"static" | "island",
	(data: BetslipStyleInput) => StyleResult
> = {
	static: ({ isOpen, breakpoint }): StyleResult => {
		// ── Mobile ──────────────────────────────────────────────────────────────
		if (breakpoint === "mobile") {
			if (isOpen) {
				document.body.classList.add("overflow-hidden");
				return {
					className: "fixed left-0 right-0 z-50 overflow-y-auto transition-all duration-300",
					style: {
						// Anchored above bottom nav, grows upward. Does NOT cover bottom nav.
						bottom: BOTTOM_NAV_HEIGHT_PX,
						maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px - ${BOTTOM_NAV_HEIGHT_PX}px)`,
					},
				};
			}
			document.body.classList.remove("overflow-hidden");
			return {
				// Slide off-screen downward when closed, but keep the element in the DOM
				// so the widget can still write into it and detect it.
				className: "fixed left-0 right-0 z-40 overflow-hidden transition-all duration-300 pointer-events-none",
				style: {
					bottom: BOTTOM_NAV_HEIGHT_PX,
					maxHeight: 0,
				},
			};
		}

		// ── Tablet ──────────────────────────────────────────────────────────────
		if (breakpoint === "tablet") {
			return {
				// Slides in from the right edge. Fixed width prevents full-width stretch.
				className: `fixed right-0 z-50 overflow-y-auto transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"
					}`,
				style: {
					top: HEADER_OFFSET_PX,
					bottom: 0,
					width: BETSLIP_WIDTH_PX,
				},
			};
		}

		// ── Desktop ─────────────────────────────────────────────────────────────
		// Sticky so it travels with its grid column and never scrolls away.
		// Width is constrained — it must NOT be allowed to fill the full page width.
		return {
			className: "sticky overflow-y-auto",
			style: {
				top: HEADER_OFFSET_PX,
				width: BETSLIP_WIDTH_PX,
				maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px)`,
				alignSelf: "flex-start",
			},
		};
	},

	island: ({ isOpen, breakpoint }): StyleResult => {
		// ── Mobile ──────────────────────────────────────────────────────────────
		if (breakpoint === "mobile") {
			if (isOpen) {
				document.body.classList.add("overflow-hidden");
				return {
					className: "fixed left-0 right-0 z-50 overflow-y-auto transition-all duration-300",
					style: {
						bottom: BOTTOM_NAV_HEIGHT_PX,
						maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px - ${BOTTOM_NAV_HEIGHT_PX}px)`,
					},
				};
			}
			document.body.classList.remove("overflow-hidden");
			return {
				className: "fixed left-0 right-0 z-40 overflow-hidden transition-all duration-300 pointer-events-none",
				style: {
					bottom: BOTTOM_NAV_HEIGHT_PX,
					maxHeight: 0,
				},
			};
		}

		// ── Tablet ──────────────────────────────────────────────────────────────
		if (breakpoint === "tablet") {
			return {
				// Centered island, constrained width, grows from bottom upward.
				className: "fixed z-[999999] overflow-y-auto transition-all duration-300",
				style: {
					bottom: 0,
					left: "50%",
					transform: "translateX(-50%)",
					width: BETSLIP_WIDTH_PX,
					maxWidth: `calc(100vw - 32px)`,
					maxHeight: isOpen ? "80dvh" : `${BOTTOM_NAV_HEIGHT_PX}px`,
				},
			};
		}

		// ── Desktop ─────────────────────────────────────────────────────────────
		return {
			className: "fixed z-[999999] overflow-y-auto transition-all duration-300",
			style: {
				bottom: 0,
				left: "50%",
				transform: "translateX(-50%)",
				width: BETSLIP_WIDTH_PX,
				maxWidth: `calc(100vw - 32px)`,
				maxHeight: isOpen ? "80dvh" : `${BOTTOM_NAV_HEIGHT_PX}px`,
			},
		};
	},
};

// ─── Pre-mount default style ──────────────────────────────────────────────────
// CRITICAL FIX: Before the widget fires toggle-widget-betslip, the betslip div
// must already be in the DOM, visible (not display:none), and accessible.
//
// If the element is hidden (display:none / visibility:hidden / zero dimensions
// with overflow:hidden), the DATA.BET widget either:
//   a) fails to find it when an odd is clicked, or
//   b) renders into it but the content is invisible
//
// This default keeps the element present and positioned at the bottom of the
// screen, out of the way, but fully available for the widget to write into.
const PRE_MOUNT_CLASS = "fixed bottom-0 left-0 right-0 z-40 h-0 overflow-hidden pointer-events-none";
const PRE_MOUNT_STYLE: React.CSSProperties = {};

// ─── Component ────────────────────────────────────────────────────────────────
export function SportsbookBetslip() {
	const [state, setState] = useState<ToggleWidgetBetslipPayload | undefined>();
	const prevIsOpenRef = useRef<boolean | undefined>(undefined);

	const initBetting = useCallback(() => {
		if (!window.bettingAPI) return;
		window.bettingAPI.subscribe("toggle-widget-betslip", (payload) => {
			setState(payload);
		});
	}, []);

	useEffect(() => {
		// Subscribe immediately if bettingAPI is already available (e.g. on re-mount)
		if (window.bettingAPI) {
			initBetting();
		}
		document.addEventListener("betting-init", initBetting);
		return () => {
			document.removeEventListener("betting-init", initBetting);
			document.body.classList.remove("overflow-hidden");
		};
	}, [initBetting]);

	// Clean up body overflow lock when mobile betslip closes or component unmounts
	useEffect(() => {
		if (!state) {
			document.body.classList.remove("overflow-hidden");
			return;
		}
		if (
			state.breakpoint === "mobile" &&
			!state.isOpen &&
			prevIsOpenRef.current === true
		) {
			document.body.classList.remove("overflow-hidden");
		}
		prevIsOpenRef.current = state.isOpen;
	}, [state]);

	// Resolve className + style from state, or use the safe pre-mount default
	let resolvedClass = PRE_MOUNT_CLASS;
	let resolvedStyle = PRE_MOUNT_STYLE;

	if (state) {
		const getter = betslipStyleGetter[state.widgetType] ?? betslipStyleGetter.static;
		const result = getter({ isOpen: state.isOpen, breakpoint: state.breakpoint });
		resolvedClass = result.className;
		resolvedStyle = result.style;
	}

	// CRITICAL: This div must ALWAYS render. Never conditionally omit it.
	// The widget relies on finding #betting-betslip in the DOM at all times.
	return (
		<div
			id={SPORTSBOOK_BETSLIP_ID}
			className={resolvedClass}
			style={resolvedStyle}
		/>
	);
}