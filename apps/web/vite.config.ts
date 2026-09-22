import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

// Must match apps/server `wrangler dev --port=3000`.
const LOCAL_API_TARGET = "http://localhost:3000";

/** TanStack pages under /auth — must not be proxied to the API worker. */
const WEB_AUTH_PAGE_PATHS = new Set([
	"/auth/callback",
	"/auth/sign-in",
	"/auth/sign-up",
	"/auth/otp",
	"/auth/phone-sign-in",
	"/auth/complete-profile",
	"/auth/forgot-password",
	"/auth/reset-password",
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

/** Browser document navigations to SPA routes that share paths with the API. */
function isDocumentNavigation(req: IncomingMessage): boolean {
	const accept = req.headers.accept ?? "";
	return accept.includes("text/html");
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

function proxyWalletToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			const path = (req.url ?? "").split("?")[0] ?? "";
			// SPA pages: /wallet and /wallet/transactions — API lives under same prefix.
			if (
				isDocumentNavigation(req) &&
				(path === "/wallet" || path === "/wallet/transactions")
			) {
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

/**
 * Proxies `GET /games` JSON (and other /games API methods) to the worker,
 * but leaves lobby navigations (`/games`, `/games?play=…`) to TanStack.
 */
function proxyGamesApiToLocalApi() {
	return {
		...proxyToLocalApi(),
		bypass(req: IncomingMessage) {
			const path = (req.url ?? "").split("?")[0] ?? "";
			if (path !== "/games" && !path.startsWith("/games/")) {
				return;
			}
			if (isDocumentNavigation(req)) {
				return req.url;
			}
		},
	};
}

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), "VITE_");
	if (command === "build" && mode === "staging") {
		if (
			!env.VITE_OPENFORT_PUBLISHABLE_KEY ||
			!env.VITE_SHIELD_PUBLISHABLE_KEY
		) {
			throw new Error(
				"Staging web build is missing VITE_OPENFORT_PUBLISHABLE_KEY or VITE_SHIELD_PUBLISHABLE_KEY in .env.staging. The Crypto tab is compiled out without both keys.",
			);
		}
	}
	if (command === "build" && mode === "production") {
		if (!env.VITE_SERVER_URL?.includes("api.sportsdey.com")) {
			throw new Error(
				"Production web build must set VITE_SERVER_URL=https://api.sportsdey.com in .env.production (run pnpm run build:production, not build:staging).",
			);
		}
		const openfortKey = env.VITE_OPENFORT_PUBLISHABLE_KEY ?? "";
		const shieldKey = env.VITE_SHIELD_PUBLISHABLE_KEY ?? "";
		const testShieldKey = "63bf703d-6b07-4924-9a9f-cfee82972b10";
		if (!openfortKey.startsWith("pk_live_") || !shieldKey) {
			throw new Error(
				"Production web build needs VITE_OPENFORT_PUBLISHABLE_KEY=pk_live_… and VITE_SHIELD_PUBLISHABLE_KEY from the same live Openfort project in .env.production. Vite also loads .env.local, so a missing production Shield key will silently bake the test key.",
			);
		}
		if (openfortKey.startsWith("pk_test_") || shieldKey === testShieldKey) {
			throw new Error(
				"Production web build cannot use the test Openfort or Shield keys. Copy the live Shield publishable key from the pk_live project dashboard into .env.production.",
			);
		}
	}

	return {
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
				"/wallet": proxyWalletToLocalApi(),
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
				"/halla": proxyToLocalApi(),
				"/thndr": proxyToLocalApi(),
				"/kyc": proxyToLocalApi(),
				"/handoff": proxyToLocalApi(),
				"/bills": proxyToLocalApi(),
				"/loyalty": proxyLoyaltyApiToLocalApi(),
				"/mission": proxyMissionApiToLocalApi(),
				"/bonus": proxyBonusApiToLocalApi(),
				"/tournament": proxyTournamentApiToLocalApi(),
				"/games": proxyGamesApiToLocalApi(),
				"/bonus-engine": proxyToLocalApi(),
				"/gamification": proxyToLocalApi(),
			},
		},
	};
});
