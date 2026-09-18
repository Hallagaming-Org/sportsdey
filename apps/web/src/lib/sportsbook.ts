import {
	constrainSportsbookThreeColumnRows,
	type DatabetLayoutConfig,
	patchDatabetLayoutConfig,
} from "./sportsbook-layout";

export const SPORTSBOOK_CONTAINER_ID = "betting__container";

/**
 * DataBet paints its SPA shell with colorsPrimary2 (#000) and a 16px inset.
 * That shell is inside the open shadow root — not the gray panels (secondary
 * colors). Strip only the shell so the widget sits on the page background.
 */
const SPORTSBOOK_HOST_CHROME_STYLE_ID = "sportsdey-sportsbook-host-chrome";
const SPORTSBOOK_HOST_CHROME_CSS = `
.ft-b1_reg.bg-colorsPrimary2 {
	background-color: transparent !important;
}
.ft-b1_reg.bg-colorsPrimary2 > .relative.flex.grow > .size-all-inherit {
	padding: 0 !important;
}
[data-id="BreakpointProvider"] {
	min-width: 0 !important;
	max-width: 100% !important;
	width: 100% !important;
}
[data-id="BreakpointProvider"] .flex {
	min-width: 0;
	max-width: 100%;
}
[data-id="BreakpointProvider"] .flex > [style*="320px"],
[data-id="BreakpointProvider"] .flex > [class*="320px"] {
	flex: 0 0 320px !important;
	flex-shrink: 0 !important;
	min-width: 320px !important;
	max-width: 320px !important;
}
/* Left sports column: do not stretch to the center column's height.
   That leftover height was rendering as a gap between Show More and
   Football / Basketball. Hug content so the list stays continuous. */
[data-id="BreakpointProvider"] .flex > [style*="320px"]:first-child,
[data-id="BreakpointProvider"] .flex > [class*="320px"]:first-child {
	align-self: flex-start !important;
	height: auto !important;
	min-height: 0 !important;
	max-height: none !important;
}
[data-id="BreakpointProvider"] .flex > [style*="320px"]:first-child .flex,
[data-id="BreakpointProvider"] .flex > [class*="320px"]:first-child .flex {
	align-content: flex-start;
}
[data-id="BreakpointProvider"] .flex > [style*="320px"]:first-child .size-all-inherit,
[data-id="BreakpointProvider"] .flex > [class*="320px"]:first-child .size-all-inherit {
	height: auto !important;
	min-height: 0 !important;
	max-height: none !important;
}
/* Center odds cells were inheriting min-width:0 from a previous overflow
   patch and shrinking below a comfortable tap target. */
[data-id="BreakpointProvider"] .text-textOdd {
	min-width: 2.75rem;
	padding-inline: 0.5rem;
	padding-block: 0.375rem;
	box-sizing: border-box;
}
`;

export function installSportsbookHostChromeFix(host: HTMLElement): () => void {
	let shadowObserver: MutationObserver | null = null;
	let observingRoot: ShadowRoot | null = null;

	const apply = () => {
		const root = host.shadowRoot;
		if (!root) return;
		if (!root.getElementById(SPORTSBOOK_HOST_CHROME_STYLE_ID)) {
			const style = document.createElement("style");
			style.id = SPORTSBOOK_HOST_CHROME_STYLE_ID;
			style.textContent = SPORTSBOOK_HOST_CHROME_CSS;
			root.appendChild(style);
		}
		constrainSportsbookThreeColumnRows(root);
		if (observingRoot !== root) {
			shadowObserver?.disconnect();
			shadowObserver = new MutationObserver(() => {
				if (!root.getElementById(SPORTSBOOK_HOST_CHROME_STYLE_ID)) {
					apply();
				} else {
					constrainSportsbookThreeColumnRows(root);
				}
			});
			shadowObserver.observe(root, { childList: true, subtree: true });
			observingRoot = root;
		}
	};

	apply();
	const hostObserver = new MutationObserver(apply);
	hostObserver.observe(host, { childList: true, subtree: true });
	const retry = window.setInterval(apply, 300);
	const stopRetry = window.setTimeout(() => window.clearInterval(retry), 20_000);

	return () => {
		hostObserver.disconnect();
		shadowObserver?.disconnect();
		window.clearInterval(retry);
		window.clearTimeout(stopRetry);
	};
}
export const SPORTSBOOK_BETSLIP_ID = "betting-betslip";
export const SPORTSBOOK_BOOTSTRAP_SCRIPT_ID = "databet-spa-bootstrap-script";
export const SPORTSBOOK_HEADER_OFFSET = 64;

/** Data.Bet prematch lobby (Live/Prematch tabs). Empty `/sportsbetting` defaults to live. */
export const SPORTSBOOK_PREMATCH_SPLAT = "sports/prematch";

export function sportsbookPrematchNavigateOptions() {
	return {
		to: "/sportsbetting/$" as const,
		params: { _splat: SPORTSBOOK_PREMATCH_SPLAT },
		search: { sports: undefined },
	} as any;
}

export type OddFormat =
	| "Decimal"
	| "Fractional"
	| "US"
	| "HongKong"
	| "Indo"
	| "Malay";

export type OddAcceptStrategy = "acceptAll" | "acceptHigher" | "alwaysAsk";

export type SportsbookThemePalette = {
	colorsPrimary1: string;
	colorsPrimary2: string;
	colorsSecondary1: string;
	colorsSecondary2: string;
	colorsSecondary3: string;
	colorsAccent1: string;
	colorsAccent2: string;
	colorsAccent3: string;
	textButton: string;
	textPrimary: string;
	textSecondary: string;
	notificationBlocked: string;
	notificationError: string;
	notificationInfo: string;
	notificationSuccess: string;
	notificationWarning: string;
};

export type AppInitOptions = {
	token: string;
	rootElement: string;
	url: {
		basename: string;
	};
	theme: {
		offsetTop: number;
		palette: SportsbookThemePalette;
	};
	defaultSettings?: {
		oddFormat?: OddFormat;
		oddAcceptStrategy?: OddAcceptStrategy;
	};
};

export type ToggleWidgetBetslipPayload = {
	breakpoint: "mobile" | "tablet" | "desktop";
	isOpen: boolean;
	widgetType: "static" | "island";
};

export type RedirectDestination = "login" | "logout" | "betting-page";

export type RedirectPayload = {
	destination: RedirectDestination;
	link?: string;
};

export type BettingAPI = {
	subscribe(
		event: "toggle-widget-betslip",
		callback: (payload: ToggleWidgetBetslipPayload) => void,
	): void;
	subscribe(
		event: "redirect",
		callback: (payload: RedirectPayload) => void,
	): void;
	subscribe(
    event: "handle-not-enough-balance",
    callback: () => void,
  ): void;
};

export type BaseWidgetStyle = {
	[key in
		| "--bet-font-sans"
		| "--bet-base-font-size"
		| "--bet-colors-primary-1"
		| "--bet-colors-primary-2"
		| "--bet-colors-secondary-1"
		| "--bet-colors-secondary-2"
		| "--bet-colors-secondary-3"
		| "--bet-colors-accent-1"
		| "--bet-colors-accent-2"
		| "--bet-colors-accent-3"
		| "--bet-text-button"
		| "--bet-text-primary"
		| "--bet-text-secondary"
		| "--bet-notification-blocked"
		| "--bet-notification-error"
		| "--bet-notification-info"
		| "--bet-notification-success"
		| "--bet-notification-warning"
		| "--bet-rounded-2"
		| "--bet-rounded-4"
		| "--bet-rounded-6"
		| "--bet-rounded-8"
		| "--bet-rounded-12"
		| "--bet-rounded-24"]?: string;
};

export type IDefaultWidgetProps = {
	style?: BaseWidgetStyle;
	"global-size"?: boolean;
	className?: string;
};

export type TopEventsOutsideWidgetProps = IDefaultWidgetProps & {
	"sport-type"?: "sports" | "esports" | "all";
	"with-sport-title"?: boolean;
};

export type BettingLoader = {
	load: (
		options: AppInitOptions,
		onLoad?: (bettingAPI: BettingAPI) => void,
	) => void;
	loadWidgets: (
		options: AppInitOptions,
		onLoad?: (bettingAPI: BettingAPI) => void,
	) => void;
	appConfig?: {
		layoutConfig?: DatabetLayoutConfig;
	};
};

/**
 * DataBet picks mobile / tablet / desktop from the BreakpointProvider's
 * clientWidth (not the window). Default desktop is 1440px, so a normal
 * laptop at 100% zoom — after our sidebar and page margins — falls into
 * tablet and drops the inline Betslip column.
 *
 * Keep those lower thresholds, but do not shrink the 320px Betslip column.
 * Category pages use a 100% flex basis on the center column, which overflows
 * the host; pin the sides and let the center fill remaining space instead.
 */
export function patchDatabetLayoutForHostChrome() {
	patchDatabetLayoutConfig(window.bettingLoader?.appConfig?.layoutConfig);
}

declare global {
	interface Window {
		bettingLoader?: BettingLoader;
		bettingAPI?: BettingAPI;
	}
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			"static-betslip-widget": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement>,
				HTMLElement
			>;
			
		}
	}
}

export function getSportsbookBootstrapScript(): string {
	return (
		(import.meta.env.VITE_DATABET_SPA_BOOTSTRAP_SCRIPT as string | undefined) ||
		""
	);
}

export function getSportsbookBasename(): string {
	return (
		(import.meta.env.VITE_DATABET_SPA_BASENAME as string | undefined) || ""
	);
}
// export function getSportsbookBootstrapScript(): string {
// 	return (
// 		(import.meta.env.VITE_DATABET_SPA_BOOTSTRAP_SCRIPT as string | undefined) ||
// 		"https://spa.int.databet.cloud/v2/f7078267/bootstrap.js"
// 	);
// }

// export function getSportsbookBasename(): string {
// 	return (
// 		(import.meta.env.VITE_DATABET_SPA_BASENAME as string | undefined) || "/sportsbook"
// 	);
// }


export function getSportsbookLocale(): string {
	return (
		(import.meta.env.VITE_DATABET_DEFAULT_LOCALE as string | undefined) || "en"
	);
}

export function isSportsbookConfigured(): boolean {
	return Boolean(getSportsbookBootstrapScript() && getSportsbookBasename());
}

export function getSportsbookTheme(isDark: boolean, offsetTop: number) {
	return {
		offsetTop,
		palette: isDark ? darkSportsbookPalette : lightSportsbookPalette,
	};
}

const lightSportsbookPalette: SportsbookThemePalette = {
	colorsPrimary1: "#000000",
	colorsPrimary2: "#ffffff",
	colorsSecondary1: "#f3f3f3",
	colorsSecondary2: "#e3e3e3",
	colorsSecondary3: "#9999a1",
	colorsAccent1: "#ff6b00",
	colorsAccent2: "#ffb700",
	colorsAccent3: "#a900d9",
	textButton: "#ffffff",
	textPrimary: "#000000",
	textSecondary: "#656565",
	notificationBlocked: "#b5b5b5",
	notificationError: "#ff3e33",
	notificationInfo: "#0852ff",
	notificationSuccess: "#05BC0B",
	notificationWarning: "#ff9000",
};

const darkSportsbookPalette: SportsbookThemePalette = {
	colorsPrimary1: "#000000",
	colorsPrimary2: "#1c1d1f",
	colorsSecondary1: "#1f1f1f",
	colorsSecondary2: "#2c2c2c",
	colorsSecondary3: "#9999a1",
	colorsAccent1: "#ff6b00",
	colorsAccent2: "#ffb700",
	colorsAccent3: "#a900d9",
	textButton: "#ffffff",
	textPrimary: "#ffffff",
	textSecondary: "#c2c2c2",
	notificationBlocked: "#7a7a7a",
	notificationError: "#ff3e33",
	notificationInfo: "#0852ff",
	notificationSuccess: "#05BC0B",
	notificationWarning: "#ff9000",
};

export function buildAppInitOptions(
	token: string,
	isDark: boolean,
): AppInitOptions {
	return {
		url: {
			basename: "/sportsbetting",
		},
		token,
		rootElement: SPORTSBOOK_CONTAINER_ID,
		theme: getSportsbookTheme(isDark, SPORTSBOOK_HEADER_OFFSET),
		defaultSettings: {
			oddFormat: "Decimal",
			oddAcceptStrategy: "acceptAll",
		},
	};
}

export function dispatchBettingInit(bettingAPI: BettingAPI) {
	window.bettingAPI = bettingAPI;
	document.dispatchEvent(new Event("betting-init"));
}

export function loadSportsbookBootstrapScript(
	scriptUrl: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const existingScript = document.getElementById(
			SPORTSBOOK_BOOTSTRAP_SCRIPT_ID,
		) as HTMLScriptElement | null;

		if (existingScript) {
			if (window.bettingLoader) {
				resolve();
				return;
			}
			existingScript.addEventListener("load", () => resolve(), { once: true });
			existingScript.addEventListener(
				"error",
				() => reject(new Error("Failed to load sportsbook bootstrap script.")),
				{ once: true },
			);
			return;
		}

		const script = document.createElement("script");
		script.id = SPORTSBOOK_BOOTSTRAP_SCRIPT_ID;
		script.type = "module";
		script.async = true;
		script.src = scriptUrl;
		script.onload = () => resolve();
		script.onerror = () =>
			reject(new Error("Failed to load sportsbook bootstrap script."));
		document.body.appendChild(script);
	});
}

export function buildWidgetInitOptions(
	token: string,
	isDark: boolean,
): AppInitOptions {
	return {
		url: {
			basename: "/sportsbetting",
		},
		token,
		rootElement: SPORTSBOOK_CONTAINER_ID,
		theme: getSportsbookTheme(isDark, SPORTSBOOK_HEADER_OFFSET),
		defaultSettings: {
			oddFormat: "Decimal",
			oddAcceptStrategy: "acceptAll",
		},
	};
}

export async function loadSportsbookWidgets(
	token: string,
	isDark: boolean,
	onLoad?: (bettingAPI: BettingAPI) => void,
): Promise<void> {
	if (!isSportsbookConfigured()) {
		throw new Error("Sportsbook widgets are not configured.");
	}

	await loadSportsbookBootstrapScript(getSportsbookBootstrapScript());

	if (!window.bettingLoader) {
		throw new Error("Betting loader is not available.");
	}
	window.bettingLoader.loadWidgets(
		buildWidgetInitOptions(token, isDark),
		(bettingAPI) => {
			dispatchBettingInit(bettingAPI);
			onLoad?.(bettingAPI);
		},
	);
}
