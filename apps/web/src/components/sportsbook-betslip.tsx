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
import { CustomBetslipFloatingButton } from "./custom-betslip-button";

// ─── Layout Constants ─────────────────────────────────────────────────────────
// Adjust BOTTOM_NAV_HEIGHT_PX to match your site's bottom navigation bar height.
const BOTTOM_NAV_HEIGHT_PX = 56;
const HEADER_OFFSET_PX = 64; // must match SPORTSBOOK_HEADER_OFFSET in sportsbook.ts
const BETSLIP_WIDTH_PX = 320;

// ─── Types ────────────────────────────────────────────────────────────────────
type BetslipStyleInput = Pick<ToggleWidgetBetslipPayload, "breakpoint" | "isOpen">;
type StyleResult = { style: React.CSSProperties; className?: string };

// ─── Style Getters ────────────────────────────────────────────────────────────
//
// RULES that apply to every single state (open, closed, pre-mount):
//
//  1. NEVER use overflow:hidden on the betslip container — the widget renders
//     content inside it and clipping breaks mount detection.
//
//  2. NEVER use display:none, visibility:hidden, or clip — same reason.
//
//  3. To "hide" the betslip when closed/pre-mount: push it off-screen with
//     translateY(100%) so it's invisible but still fully accessible to the widget.
//
//  4. Always use inline styles (not Tailwind classes) for values that include
//     runtime constants (BOTTOM_NAV_HEIGHT_PX, etc.) to avoid Tailwind JIT
//     purging arbitrary values.
//
//  5. The betslip is ALWAYS anchored at the bottom of the viewport and grows
//     upward — this is the correct direction on all breakpoints.
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
					className: "w-full sm:max-w-[320px]",
					style: {
						position: "fixed",
						right: 0,
						// Anchored above bottom nav, grows upward from there
						bottom: BOTTOM_NAV_HEIGHT_PX,
						// Fills available screen space between header and bottom nav
						maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px - ${BOTTOM_NAV_HEIGHT_PX}px)`,
						overflowY: "auto",
						zIndex: 50,
						transform: "translateY(0)",
						transition: "transform 0.3s ease",
					},
				};
			}
			// Closed: slide off-screen downward — DO NOT use overflow:hidden or display:none
			document.body.classList.remove("overflow-hidden");
			return {
				className: "w-full sm:max-w-[320px]",
				style: {
					position: "fixed",
					right: 0,
					bottom: BOTTOM_NAV_HEIGHT_PX,
					maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px - ${BOTTOM_NAV_HEIGHT_PX}px)`,
					overflowY: "auto",
					zIndex: 40,
					// Slide down out of view — element stays in DOM and unclipped
					transform: "translateY(calc(100% + 100px))",
					transition: "transform 0.3s ease",
					pointerEvents: "none",
				},
			};
		}

		// ── Tablet ──────────────────────────────────────────────────────────────
		if (breakpoint === "tablet") {
			return {
				style: {
					position: "fixed",
					// Bottom-anchored, grows upward to fill the space below the header
					bottom: 0,
					top: HEADER_OFFSET_PX,
					right: 0,
					width: BETSLIP_WIDTH_PX,
					overflowY: "auto",
					zIndex: 50,
					// Slide in/out from the right edge
					transform: isOpen ? "translateX(0)" : "translateX(110%)",
					transition: "transform 0.3s ease",
				},
			};
		}

		// ── Desktop ─────────────────────────────────────────────────────────────
		// Sticky within its layout column, bottom-anchored feel via top offset
		return {
			style: {
				position: "sticky",
				top: HEADER_OFFSET_PX,
				// Constrained width — must never stretch to full page width
				width: BETSLIP_WIDTH_PX,
				maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px)`,
				overflowY: "auto",
				alignSelf: "flex-start",
				zIndex: 40,
			},
		};
	},

	island: ({ isOpen, breakpoint }): StyleResult => {
		// ── Mobile ──────────────────────────────────────────────────────────────
		if (breakpoint === "mobile") {
			if (isOpen) {
				document.body.classList.add("overflow-hidden");
				return {
					className: "w-full sm:max-w-[320px]",
					style: {
						position: "fixed",
						left: 0,
						right: 0,
						margin: "0 auto",
						bottom: BOTTOM_NAV_HEIGHT_PX,
						maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px - ${BOTTOM_NAV_HEIGHT_PX}px)`,
						overflowY: "auto",
						zIndex: 50,
						transform: "translateY(0)",
						transition: "transform 0.3s ease",
					},
				};
			}
			document.body.classList.remove("overflow-hidden");
			return {
				className: "w-full sm:max-w-[320px]",
				style: {
					position: "fixed",
					left: 0,
					right: 0,
					margin: "0 auto",
					bottom: BOTTOM_NAV_HEIGHT_PX,
					maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px - ${BOTTOM_NAV_HEIGHT_PX}px)`,
					overflowY: "auto",
					zIndex: 40,
					transform: "translateY(calc(100% + 100px))",
					transition: "transform 0.3s ease",
					pointerEvents: "none",
				},
			};
		}

		// ── Tablet ──────────────────────────────────────────────────────────────
		if (breakpoint === "tablet") {
			return {
				style: {
					position: "fixed",
					// Centered island, bottom-anchored, grows upward
					bottom: 0,
					left: "50%",
					width: BETSLIP_WIDTH_PX,
					maxWidth: "calc(100vw - 32px)",
					// Expands upward when open, shows a small handle when closed
					maxHeight: isOpen
						? `calc(100dvh - ${HEADER_OFFSET_PX}px)`
						: "56px",
					overflowY: "auto",
					zIndex: 999999,
					transition: "transform 0.3s ease, max-height 0.3s ease",
					transform: isOpen ? "translateX(-50%)" : "translateX(-50%) translateY(calc(100% + 100px))",
					pointerEvents: isOpen ? "auto" : "none",
				},
			};
		}

		// ── Desktop ─────────────────────────────────────────────────────────────
		return {
			style: {
				position: "fixed",
				bottom: 0,
				left: "50%",
				transform: isOpen ? "translateX(-50%)" : "translateX(-50%) translateY(calc(100% + 100px))",
				pointerEvents: isOpen ? "auto" : "none",
				width: BETSLIP_WIDTH_PX,
				maxWidth: "calc(100vw - 32px)",
				maxHeight: isOpen
					? `calc(100dvh - ${HEADER_OFFSET_PX}px)`
					: "56px",
				overflowY: "auto",
				zIndex: 999999,
				transition: "transform 0.3s ease, max-height 0.3s ease",
			},
		};
	},
};

// ─── Pre-mount style ──────────────────────────────────────────────────────────
//
// Applied before the widget fires toggle-widget-betslip for the first time.
//
// CRITICAL RULES:
//   - Must be position:fixed so it doesn't affect page layout
//   - Must NOT use overflow:hidden (clips widget mount)
//   - Must NOT use display:none or visibility:hidden
//   - translateY(110%) pushes it below the viewport — invisible but fully real
//   - pointerEvents:none prevents accidental interaction
//   - The element is ALWAYS rendered, never conditionally removed
//
const PRE_MOUNT_STYLE: React.CSSProperties = {
	position: "fixed",
	left: 0,
	right: 0,
	margin: "0 auto",
	bottom: 0,
	// Large enough that the widget can render into it, but pushed off-screen
	maxHeight: `calc(100dvh - ${HEADER_OFFSET_PX}px)`,
	overflowY: "auto",   // NOT hidden — widget must be able to write into this
	zIndex: 40,
	transform: "translateY(calc(100% + 100px))",  // off-screen, not clipped
	pointerEvents: "none",
	transition: "transform 0.3s ease",
};

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
		// Subscribe immediately if bettingAPI is already ready (e.g. hot reload / re-mount)
		if (window.bettingAPI) {
			initBetting();
		}
		document.addEventListener("betting-init", initBetting);
		return () => {
			document.removeEventListener("betting-init", initBetting);
			document.body.classList.remove("overflow-hidden");
		};
	}, [initBetting]);

	// Remove body overflow lock when mobile betslip transitions from open → closed
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

	// Resolve the inline style from current state, or fall back to pre-mount
	let resolvedStyle: React.CSSProperties = PRE_MOUNT_STYLE;
	let resolvedClassName: string = "w-full sm:max-w-[320px]";

	if (state) {
		const getter = betslipStyleGetter[state.widgetType] ?? betslipStyleGetter.static;
		const result = getter({
			isOpen: state.isOpen,
			breakpoint: state.breakpoint,
		});
		resolvedStyle = result.style;
		resolvedClassName = result.className ?? "";
	}

	// This div MUST always be rendered — never conditionally omit it.
	// The DATA.BET widget finds #betting-betslip by ID and populates it when
	// an odd is clicked. If the element doesn't exist, nothing happens.
	return (
		<>
			<div
				id={SPORTSBOOK_BETSLIP_ID}
				style={resolvedStyle}
				className={resolvedClassName}
			/>
			<CustomBetslipFloatingButton isOpen={!!state?.isOpen} />
		</>
	);
}