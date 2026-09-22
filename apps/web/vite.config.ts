import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

const LOCAL_API_TARGET = "http://localhost:3000";

/** TanStack pages under /auth — must not be proxied to the API worker. */
const WEB_AUTH_PAGE_PATHS = new Set([
	"/auth/callback",
	"/auth/sign-in",
	"/auth/sign-up",
	"/auth/otp",
	"/auth/phone-sign-in",
	"/auth/complete-profile",
]);

function shouldProxyAuthToApi(requestUrl: string | undefined): boolean {
	const path = (requestUrl ?? "").split("?")[0] ?? "";
	return !WEB_AUTH_PAGE_PATHS.has(path);
}

function proxyToLocalApi() {
	return {
		target: LOCAL_API_TARGET,
		changeOrigin: true,
	};
}

function proxyAuthToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			if (!shouldProxyAuthToApi(req.url)) {
				// Let Vite / TanStack serve the frontend route (e.g. OAuth landing page).
				return req.url;
			}
		},
	};
}

/**
 * Proxies Bonus Engine mission API (`/mission/*`) without swallowing the
 * TanStack `/missions` page — Vite prefix matching treats `/missions` as
 * under `/mission`.
 */
function proxyMissionApiToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			const path = (req.url ?? "").split("?")[0] ?? "";
			if (path === "/missions" || path.startsWith("/missions/")) {
				return req.url;
			}
		},
	};
}

function proxyBonusApiToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			const path = (req.url ?? "").split("?")[0] ?? "";
			if (path === "/bonuses" || path.startsWith("/bonuses/")) {
				return req.url;
			}
		},
	};
}

/**
 * Proxies Bonus Engine tournament API (`/tournament/*`) without swallowing the
 * TanStack `/tournaments` page — Vite prefix matching treats `/tournaments` as
 * under `/tournament`.
 */
function proxyTournamentApiToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			const path = (req.url ?? "").split("?")[0] ?? "";
			if (path === "/tournaments" || path.startsWith("/tournaments/")) {
				return req.url;
			}
		},
	};
}

function proxyLoyaltyApiToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			const path = (req.url ?? "").split("?")[0] ?? "";
			if (path === "/loyalty" || path === "/loyalty/") {
				return req.url;
			}
			if (!path.startsWith("/loyalty/")) {
				return req.url;
			}
		},
	};
}

export default defineConfig({
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tsconfigPaths(),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		svgr(),
	],
	server: {
		proxy: {
			"/auth": proxyAuthToLocalApi(),
			"/phone-auth": proxyToLocalApi(),
			"/user": proxyToLocalApi(),
			"/wallet": proxyToLocalApi(),
			"/cms": proxyToLocalApi(),
			"/football": proxyToLocalApi(),
			"/basketball": proxyToLocalApi(),
			"/tennis": proxyToLocalApi(),
			"/news": proxyToLocalApi(),
			"/notifications": proxyToLocalApi(),
			"/files": proxyToLocalApi(),
			"/affnook": proxyToLocalApi(),
			"/sportsbook": proxyToLocalApi(),
			"/tcds": proxyToLocalApi(),
			"/casino": proxyToLocalApi(),
			"/kyc": proxyToLocalApi(),
			"/bills": proxyToLocalApi(),
			"/loyalty": proxyLoyaltyApiToLocalApi(),
			"/mission": proxyMissionApiToLocalApi(),
			"/bonus": proxyBonusApiToLocalApi(),
			"/tournament": proxyTournamentApiToLocalApi(),
			"/bonus-engine": proxyToLocalApi(),
			"/gamification": proxyToLocalApi(),
		},
	},
});
