import { fetchWithTimeout } from "@/utils/fetch-with-timeout";
import type { CloudflareBindings } from "../types";

const DEFAULT_TRADING_BASE_URL = "https://binary.sportsdey.com";
const SESSION_HASH_COOKIE_NAMES = [
	"__Secure-ba.session_token_hash",
	"ba.session_token_hash",
] as const;

export type RemoteTradeRecord = Record<string, unknown>;

function readToken(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractToken(payload: unknown): string | null {
	if (!payload || typeof payload !== "object") return null;
	const root = payload as Record<string, unknown>;
	const candidates = [
		root.token,
		root.accessToken,
		root.access_token,
		root.authToken,
		root.auth_token,
		typeof root.result === "string" ? root.result : null,
		(root.result as Record<string, unknown> | undefined)?.token,
		(root.result as Record<string, unknown> | undefined)?.accessToken,
		(root.result as Record<string, unknown> | undefined)?.authToken,
		(root.data as Record<string, unknown> | undefined)?.token,
		(root.data as Record<string, unknown> | undefined)?.accessToken,
		(root.data as Record<string, unknown> | undefined)?.authToken,
	];
	for (const candidate of candidates) {
		const token = readToken(candidate);
		if (token) return token;
	}
	return null;
}

function extractDocs(payload: unknown): RemoteTradeRecord[] {
	if (!payload || typeof payload !== "object") return [];
	const root = payload as Record<string, unknown>;
	const result = root.result;
	const data = root.data;
	const candidates = [
		root.docs,
		(result as Record<string, unknown> | undefined)?.docs,
		(data as Record<string, unknown> | undefined)?.docs,
		Array.isArray(result) ? result : null,
		Array.isArray(data) ? data : null,
	];
	const records = candidates.find((candidate) => Array.isArray(candidate));
	return Array.isArray(records)
		? records.filter(
					(record): record is RemoteTradeRecord =>
						typeof record === "object" && record !== null,
				  )
		: [];
}

function readRequestCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("Cookie");
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 0) continue;
		if (part.slice(0, separator).trim() === name) {
			return part.slice(separator + 1).trim();
		}
	}
	return undefined;
}

/**
 * Fetches the authenticated user's unified binary-service trade history.
 * The Better Auth session hash is exchanged server-to-server and is never
 * returned to the caller or written to logs.
 */
export async function fetchSportsDeyTradeHistory(
	request: Request,
	env: CloudflareBindings,
	): Promise<RemoteTradeRecord[]> {
	const sessionHash = SESSION_HASH_COOKIE_NAMES.map((name) =>
		readRequestCookie(request, name),
	).find(Boolean);
	if (!sessionHash) return [];

	const baseUrl =
		env.SPORTSDEY_BINARY_BASE_URL?.trim() || DEFAULT_TRADING_BASE_URL;
	try {
		const tokenResponse = await fetchWithTimeout(
			`${baseUrl}/sportsdayApi/getAuthToken`,
			{
				method: "GET",
				headers: {
					Accept: "application/json",
					Authorization: decodeURIComponent(sessionHash),
				},
			},
			4000,
		);
		if (!tokenResponse.ok) return [];
		const tokenPayload: unknown = await tokenResponse.json();
		const accessToken = extractToken(tokenPayload);
		if (!accessToken) return [];

		const historyResponse = await fetchWithTimeout(
			`${baseUrl}/sportsdayApi/get-sportsdey-trade-history`,
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ type: "all", page: 1, limit: 100 }),
			},
			4000,
		);
		if (!historyResponse.ok) return [];
		return extractDocs(await historyResponse.json());
	} catch {
		// A provider outage must not hide the local sportsbook/casino history.
		return [];
	}
}
