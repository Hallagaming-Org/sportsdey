import type { CloudflareBindings } from "../types";

/**
 * Call Data.Bet through the sportsbook proxy.
 * Staging uses `sportsbook-staging`; otherwise `sportsbook`.
 */
export async function databetFetch(
	env: CloudflareBindings,
	path: string,
	options: {
		method?: string;
		body?: unknown;
		query?: Record<string, string | string[] | undefined>;
		headers?: Record<string, string>;
	} = {},
): Promise<Response> {
	const proxyUrl = env.PROXY_URL?.trim();
	const proxySecret = env.PROXY_SECRET?.trim();

	if (!proxyUrl) {
		throw new Error("PROXY_URL not configured");
	}
	if (!proxySecret) {
		throw new Error("PROXY_SECRET not configured");
	}

	const searchParams = new URLSearchParams();
	if (options.query) {
		for (const [key, value] of Object.entries(options.query)) {
			if (value === undefined) {
				continue;
			}
			for (const item of Array.isArray(value) ? value : [value]) {
				searchParams.append(Array.isArray(value) ? `${key}[]` : key, item);
			}
		}
	}

	const baseUrl = `${proxyUrl.replace(/\/+$/, "")}/${env.NODE_ENV === "staging" ? "sportsbook-staging" : "sportsbook"}${path.startsWith("/") ? path : `/${path}`}`;
	const url =
		searchParams.size > 0 ? `${baseUrl}?${searchParams.toString()}` : baseUrl;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"X-Proxy-Auth": proxySecret,
		...options.headers,
	};

	try {
		return await fetch(url, {
			method: options.method || "GET",
			headers,
			body: options.body ? JSON.stringify(options.body) : undefined,
		});
	} catch (error) {
		console.error("Sportsbook proxy request threw", {
			path,
			nodeEnv: env.NODE_ENV,
			proxyTarget: url,
			hasProxyUrl: Boolean(proxyUrl),
			hasProxySecret: Boolean(proxySecret),
			hasDatabetCertBinding: Boolean(
				(env as unknown as Record<string, unknown>).DATABET_CERT,
			),
			error:
				error instanceof Error
					? {
							name: error.name,
							message: error.message,
							stack: error.stack,
						}
					: String(error),
		});
		throw error;
	}
}
