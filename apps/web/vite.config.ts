import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

// Must match apps/web/.env VITE_SERVER_URL (wrangler --port=8787).
// Do NOT proxy "/games" — that path is the TanStack lobby page; the API is reached via VITE_SERVER_URL.
const LOCAL_API_TARGET = "http://localhost:8787";

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
		headers: {
			// credentialless allows cross-origin casino thumbnails (Scorpio CDNs)
			// without CORP headers, while keeping COOP for isolation.
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "credentialless",
		},
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
			"/slotegrator": proxyToLocalApi(),
			"/scorpio": proxyToLocalApi(),
			"/lagos-rush": proxyToLocalApi(),
			"/thndr": proxyToLocalApi(),
			"/kyc": proxyToLocalApi(),
			"/bills": proxyToLocalApi(),
		},
	},
});
