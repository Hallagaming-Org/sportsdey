import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";


const LOCAL_API_TARGET = "http://localhost:3000";

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

function proxyGamesApiToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			const path = (req.url ?? "").split("?")[0] ?? "";
			if (path !== "/games" && !path.startsWith("/games/")) {
				return;
			}
			const accept = req.headers.accept ?? "";
			if (accept.includes("text/html")) {
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
			"/games": proxyGamesApiToLocalApi(),
			"/bonus-engine": proxyToLocalApi(),
			"/gamification": proxyToLocalApi(),
		},
	},
});
