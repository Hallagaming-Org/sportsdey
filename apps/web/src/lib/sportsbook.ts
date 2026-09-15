export const SPORTSBOOK_CONTAINER_ID = "betting__container";
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
	updateThemeConfig?: (
		theme: { offsetTop: number; palette: SportsbookThemePalette },
		options?: { replace?: boolean },
	) => void;
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
};

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
	colorsPrimary1: "#f4f4f4",
	colorsPrimary2: "#ffffff",
	colorsSecondary1: "#f3f3f3",
	colorsSecondary2: "#e3e3e3",
	colorsSecondary3: "#9999a1",
	colorsAccent1: "#1baa04",
	colorsAccent2: "#ffb700",
	colorsAccent3: "#1baa04",
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
	colorsPrimary1: "#040c01",
	colorsPrimary2: "#040c01",
	colorsSecondary1: "#1c1c1e",
	colorsSecondary2: "#2c2c2c",
	colorsSecondary3: "#9999a1",
	colorsAccent1: "#1baa04",
	colorsAccent2: "#ffb700",
	colorsAccent3: "#1baa04",
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

const SPORTSBOOK_SHADOW_STYLE_ID = "sportsdey-sportsbook-overrides";
const SPORTSBOOK_ACCENT_GREEN = "#1baa04";
const SPORTSBOOK_ACCENT_GREEN_RGB = "27, 170, 4";

const SPORTSBOOK_PANEL_BG = "#1c1c1e";
const SPORTSBOOK_PANEL_BG_RGB = "28, 28, 30";
const SPORTSBOOK_ODDS_PANEL_BG = "#141416";

const SPORTSBOOK_ACCENT_VARS = {
	"--bet-colors-secondary-1": SPORTSBOOK_PANEL_BG,
	"--bet-colors-secondary-1-rgb": SPORTSBOOK_PANEL_BG_RGB,
	"--bet-colors-accent-1": SPORTSBOOK_ACCENT_GREEN,
	"--bet-colors-accent-1-rgb": SPORTSBOOK_ACCENT_GREEN_RGB,
	"--bet-colors-accent-3": SPORTSBOOK_ACCENT_GREEN,
	"--bet-colors-accent-3-rgb": SPORTSBOOK_ACCENT_GREEN_RGB,
} as const;

/** DataBet mounts in an open shadow root; document CSS cannot restyle `.bg-colorsSecondary1`. */
const SPORTSBOOK_SHADOW_CSS = `
#bet-root,
.bet-tailwind-root {
	background-color: transparent !important;
	--bet-colors-secondary-1: ${SPORTSBOOK_PANEL_BG} !important;
	--bet-colors-secondary-1-rgb: ${SPORTSBOOK_PANEL_BG_RGB} !important;
	--bet-colors-accent-1: ${SPORTSBOOK_ACCENT_GREEN} !important;
	--bet-colors-accent-1-rgb: ${SPORTSBOOK_ACCENT_GREEN_RGB} !important;
	--bet-colors-accent-3: ${SPORTSBOOK_ACCENT_GREEN} !important;
	--bet-colors-accent-3-rgb: ${SPORTSBOOK_ACCENT_GREEN_RGB} !important;
}

/* Top Events: style the DataBet card shell only. Do not pad/size the
   isolate wrapper — that squeezed team rows and hid the away side. */
[data-testid="top-events-widget-event-link"] .min-h-full.flex-col.bg-colorsSecondary1 {
	background-color: ${SPORTSBOOK_PANEL_BG} !important;
	border: 1px solid rgba(255, 255, 255, 0.05) !important;
	border-radius: 12px !important;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

/* Odds 1/X/2 sit in a darker sub-panel; keep DataBet's own button chrome. */
[data-testid="top-events-widget-event-link"] .gap-2.overflow-hidden.rounded-8 {
	background-color: ${SPORTSBOOK_ODDS_PANEL_BG} !important;
}
[data-testid="top-events-widget-event-link"] .grid.flex-1.bg-colorsSecondary1 {
	background-color: transparent !important;
	border: none !important;
	box-shadow: none !important;
}

/* Keep carousel arrows off the match cards. */
.top-events-carousel .absolute.inset-0.flex.items-center.justify-between {
	left: -4px;
	right: -4px;
	width: auto;
	padding-left: 0 !important;
	padding-right: 0 !important;
}

/* HOT BUNDLES: each league/combo column is already hot-bundle-card. */
[data-testid="hot-bundle-card"] {
	background-color: ${SPORTSBOOK_PANEL_BG} !important;
	border: 1px solid rgba(255, 255, 255, 0.05) !important;
	border-radius: 12px !important;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

.bet-tailwind-root .text-colorsAccent3,
.bet-tailwind-root .fill-colorsAccent3,
.bet-tailwind-root .stroke-colorsAccent3,
.bet-tailwind-root .bg-colorsAccent3,
.text-colorsAccent3,
.fill-colorsAccent3,
.stroke-colorsAccent3 {
	color: ${SPORTSBOOK_ACCENT_GREEN} !important;
	fill: ${SPORTSBOOK_ACCENT_GREEN} !important;
	stroke: ${SPORTSBOOK_ACCENT_GREEN} !important;
}

/* DataBet type scale is calc(var(--bet-base-font-size) * n). Default 16px
   makes match names/odds ~12px on phones. Bump the base on small screens. */
@media (max-width: 767px) {
	#bet-root,
	.bet-tailwind-root {
		--bet-base-font-size: 20px !important;
	}
}
@media (min-width: 768px) and (max-width: 1023px) {
	#bet-root,
	.bet-tailwind-root {
		--bet-base-font-size: 18px !important;
	}
}
`;

function pinSportsbookAccentVars(el: HTMLElement) {
	for (const [name, value] of Object.entries(SPORTSBOOK_ACCENT_VARS)) {
		if (
			el.style.getPropertyValue(name) === value &&
			el.style.getPropertyPriority(name) === "important"
		) {
			continue;
		}
		el.style.setProperty(name, value, "important");
	}
}

function pinSportsbookAccentOnTree(root: ParentNode) {
	if (root instanceof HTMLElement) {
		pinSportsbookAccentVars(root);
	}
	root.querySelectorAll<HTMLElement>("#bet-root, .bet-tailwind-root").forEach(
		pinSportsbookAccentVars,
	);
}

export function injectSportsbookShadowOverrides(): boolean {
	const host = document.getElementById(SPORTSBOOK_CONTAINER_ID);
	if (!host) {
		return false;
	}
	pinSportsbookAccentVars(host);
	const shadow = host.shadowRoot;
	if (!shadow) {
		return false;
	}
	pinSportsbookAccentOnTree(shadow);
	const existing = shadow.getElementById(SPORTSBOOK_SHADOW_STYLE_ID);
	if (existing) {
		if (existing.textContent !== SPORTSBOOK_SHADOW_CSS) {
			existing.textContent = SPORTSBOOK_SHADOW_CSS;
		}
		return true;
	}
	const style = document.createElement("style");
	style.id = SPORTSBOOK_SHADOW_STYLE_ID;
	style.textContent = SPORTSBOOK_SHADOW_CSS;
	shadow.appendChild(style);
	return true;
}

let sportsbookOverrideObserver: MutationObserver | null = null;

export function scheduleSportsbookShadowOverrides() {
	injectSportsbookShadowOverrides();
	if (!sportsbookOverrideObserver) {
		sportsbookOverrideObserver = new MutationObserver(() => {
			injectSportsbookShadowOverrides();
		});
	}
	const host = document.getElementById(SPORTSBOOK_CONTAINER_ID);
	if (host) {
		sportsbookOverrideObserver.observe(host, {
			attributes: true,
			attributeFilter: ["style", "class"],
			childList: true,
			subtree: true,
		});
		if (host.shadowRoot) {
			sportsbookOverrideObserver.observe(host.shadowRoot, {
				attributes: true,
				attributeFilter: ["style", "class"],
				childList: true,
				subtree: true,
			});
		}
	}
	let attempts = 0;
	const timer = window.setInterval(() => {
		attempts += 1;
		const ready = injectSportsbookShadowOverrides();
		if ((ready && attempts >= 10) || attempts >= 80) {
			window.clearInterval(timer);
		}
	}, 100);
}

export function applySportsbookRuntimeTheme(isDark: boolean) {
	window.bettingAPI?.updateThemeConfig?.(
		getSportsbookTheme(isDark, SPORTSBOOK_HEADER_OFFSET),
	);
	injectSportsbookShadowOverrides();
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
			applySportsbookRuntimeTheme(isDark);
			scheduleSportsbookShadowOverrides();
			onLoad?.(bettingAPI);
		},
	);
}
