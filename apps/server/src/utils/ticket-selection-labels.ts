import type { CloudflareBindings } from "../types";

export type StoredBetOdd = {
	odd_id?: string;
	odd_ratio?: string;
	odd_status?: number;
	match_id?: string;
	market_id?: string;
};

export type MarketOutcome = {
	name: string;
	value: string;
};

export type SpecifierDef = {
	name?: string;
	value?: string;
};

export type MarketDefinition = {
	id: number | string;
	outcomes?: MarketOutcome[];
	localizations?: Array<{ locale?: string; template?: string }>;
	specifiers?: SpecifierDef[];
};

export type TicketSelectionLabels = {
	market: string | null;
	pick: string | null;
	odds: string | null;
};

export function sportsbookApiBase(env: CloudflareBindings): string | null {
	const proxyUrl = env.PROXY_URL?.trim();
	if (!proxyUrl) return null;
	const ns =
		(env.NODE_ENV || "").toLowerCase() === "staging"
			? "sportsbook-staging"
			: "sportsbook";
	return `${proxyUrl.replace(/\/+$/, "")}/${ns}`;
}

export function parseMarketId(marketId: string): {
	typeId: string;
	encodedSpecifiers: string;
} {
	const match = marketId.match(/^(\d+)(.*)$/);
	if (!match?.[1]) {
		return { typeId: marketId, encodedSpecifiers: "" };
	}
	return { typeId: match[1], encodedSpecifiers: match[2] ?? "" };
}

function specifierInitial(def: SpecifierDef): string | null {
	const letter = def.name?.[0];
	return letter ? letter.toLowerCase() : null;
}

function isNumericSpecifierType(type: string | undefined): boolean {
	return type === "integer" || type === "decimal" || type === "variable_text";
}

function looksLikeNumericValue(encoded: string, index: number): boolean {
	const ch = encoded[index];
	if (ch === "-" && /[0-9]/.test(encoded[index + 1] ?? "")) return true;
	return /[0-9]/.test(ch ?? "");
}

function parseNumericValue(
	encoded: string,
	index: number,
	type?: string,
): { raw: string; next: number } {
	let raw = "";
	let i = index;
	if (encoded[i] === "-") {
		raw += "-";
		i += 1;
	}
	while (i < encoded.length) {
		const ch = encoded[i] ?? "";
		if (/[0-9]/.test(ch)) {
			raw += ch;
			i += 1;
			continue;
		}
		if (ch === "_" && type !== "integer") {
			raw += ".";
			i += 1;
			continue;
		}
		if (
			ch === "-" &&
			raw.length > 0 &&
			raw !== "-" &&
			/[0-9]/.test(encoded[i + 1] ?? "")
		) {
			raw += "-";
			i += 1;
			continue;
		}
		break;
	}
	return { raw, next: i };
}

function parseStringValue(
	encoded: string,
	index: number,
	unused: SpecifierDef[],
): { raw: string; next: number } {
	let i = index;
	while (i < encoded.length) {
		const ch = encoded[i] ?? "";
		const initial = ch.toLowerCase();
		if (/[a-z]/.test(initial)) {
			const nextSpec = unused.find((def) => specifierInitial(def) === initial);
			if (
				nextSpec &&
				isNumericSpecifierType(nextSpec.value) &&
				looksLikeNumericValue(encoded, i + 1)
			) {
				break;
			}
		}
		i += 1;
	}
	return { raw: encoded.slice(index, i), next: i };
}

function prettyStringSpecifier(raw: string): string {
	return raw.replace(/([a-z0-9])vs([a-z])/gi, "$1 vs $2");
}

export function decodeSpecifiers(
	encoded: string,
	defs: SpecifierDef[],
): Record<string, string> {
	const result: Record<string, string> = {};
	const unused = defs.filter((def) => def.name);
	let i = 0;
	while (i < encoded.length) {
		const letter = encoded[i];
		if (!letter || !/[a-z]/i.test(letter)) {
			i += 1;
			continue;
		}
		const specIndex = unused.findIndex(
			(def) => specifierInitial(def) === letter.toLowerCase(),
		);
		if (specIndex < 0) {
			i += 1;
			continue;
		}
		const spec = unused.splice(specIndex, 1)[0];
		i += 1;
		const parsed =
			spec?.value === "string"
				? parseStringValue(encoded, i, unused)
				: isNumericSpecifierType(spec?.value) || looksLikeNumericValue(encoded, i)
					? parseNumericValue(encoded, i, spec?.value)
					: parseStringValue(encoded, i, unused);
		if (spec?.name && parsed.raw) {
			result[spec.name] =
				spec.value === "string"
					? prettyStringSpecifier(parsed.raw)
					: parsed.raw;
		}
		i = parsed.next;
	}
	return result;
}

export function competitorsFromMatchTitle(title: string | null | undefined): {
	competitor1?: string;
	competitor2?: string;
} {
	if (!title) return {};
	const parts = title.split(/\s+vs\.?\s+/i);
	if (parts.length < 2) return {};
	const competitor1 = parts[0]?.trim();
	const competitor2 = parts.slice(1).join(" vs ").trim();
	if (!competitor1 || !competitor2) return {};
	return { competitor1, competitor2 };
}

function toOrdinal(value: string): string {
	const num = Number.parseInt(value, 10);
	if (!Number.isFinite(num)) return value;
	const remainder = num % 100;
	if (remainder >= 11 && remainder <= 13) return `${num}th`;
	switch (num % 10) {
		case 1:
			return `${num}st`;
		case 2:
			return `${num}nd`;
		case 3:
			return `${num}rd`;
		default:
			return `${num}th`;
	}
}

function formatSignedHcp(
	hcp: string | undefined,
	invert: boolean,
): string | null {
	if (hcp == null || hcp === "") return null;
	const parsed = Number.parseFloat(hcp);
	if (!Number.isFinite(parsed)) return invert ? `-${hcp}` : hcp;
	const value = invert ? -parsed : parsed;
	if (value > 0) return `+${value}`;
	return String(value);
}

export function compileTemplate(
	template: string,
	ctx: {
		competitor1?: string;
		competitor2?: string;
		specifiers: Record<string, string>;
	},
): string {
	let out = template;
	out = out.replace(/\{!([a-z0-9_]+)\}/gi, (_full, key: string) => {
		const value = ctx.specifiers[key];
		return value ? toOrdinal(value) : `{!${key}}`;
	});
	if (ctx.competitor1) {
		out = out.replace(/\{\$competitor1\}/gi, ctx.competitor1);
	}
	if (ctx.competitor2) {
		out = out.replace(/\{\$competitor2\}/gi, ctx.competitor2);
	}
	const plusHcp = formatSignedHcp(ctx.specifiers.hcp, false);
	const minusHcp = formatSignedHcp(ctx.specifiers.hcp, true);
	if (plusHcp) out = out.replace(/\{\+hcp\}/g, plusHcp);
	if (minusHcp) out = out.replace(/\{-hcp\}/g, minusHcp);
	for (const [key, value] of Object.entries(ctx.specifiers)) {
		out = out.replace(new RegExp(`\\{${key}\\}`, "g"), value);
	}
	return out.replace(/\s+/g, " ").trim();
}

export function englishMarketTemplate(
	localizations: MarketDefinition["localizations"],
): string | null {
	if (!localizations?.length) return null;
	for (const locale of ["en", "en_US", "en_GB"]) {
		const hit = localizations.find(
			(item) => item.locale === locale && item.template?.trim(),
		);
		if (hit?.template) return hit.template.trim();
	}
	const any = localizations.find((item) => item.template?.trim());
	return any?.template?.trim() ?? null;
}

function prettifyPick(value: string): string {
	if (!value) return value;
	const first = value.charAt(0);
	if (first !== first.toLowerCase()) return value;
	return first.toUpperCase() + value.slice(1);
}

export function formatOdds(oddRatio: string | null | undefined): string | null {
	if (!oddRatio) return null;
	const parsed = Number.parseFloat(oddRatio);
	if (!Number.isFinite(parsed)) return oddRatio;
	return String(parsed);
}

export function formatTicketSelection(input: {
	odd: StoredBetOdd;
	matchTitle: string | null;
	marketDef: MarketDefinition | null;
}): TicketSelectionLabels {
	const odds = formatOdds(input.odd.odd_ratio ?? null);
	const marketId = input.odd.market_id;
	if (!marketId || !input.marketDef) {
		return { market: null, pick: null, odds };
	}

	const { encodedSpecifiers } = parseMarketId(marketId);
	const specifiers = decodeSpecifiers(
		encodedSpecifiers,
		input.marketDef.specifiers ?? [],
	);
	const teams = competitorsFromMatchTitle(input.matchTitle);
	const ctx = { ...teams, specifiers };

	const marketTemplate = englishMarketTemplate(input.marketDef.localizations);
	const market = marketTemplate ? compileTemplate(marketTemplate, ctx) : null;

	const oddId = input.odd.odd_id != null ? String(input.odd.odd_id) : "";
	const outcome = (input.marketDef.outcomes ?? []).find(
		(item) => String(item.name) === oddId,
	);
	const pickRaw = outcome?.value ? compileTemplate(outcome.value, ctx) : "";
	const pick =
		pickRaw && !pickRaw.includes("{") ? prettifyPick(pickRaw) : null;
	const marketLabel = market && !market.includes("{") ? market : null;

	return { market: marketLabel, pick, odds };
}

export function collectTicketOdds(betData: unknown): StoredBetOdd[] {
	if (!betData || typeof betData !== "object") return [];
	const data = betData as {
		bet_odds?: unknown;
		bet_builder_odds?: unknown;
	};
	const odds: StoredBetOdd[] = [];
	if (Array.isArray(data.bet_odds)) {
		odds.push(...(data.bet_odds as StoredBetOdd[]));
	}
	if (Array.isArray(data.bet_builder_odds)) {
		for (const group of data.bet_builder_odds) {
			if (
				group &&
				typeof group === "object" &&
				Array.isArray((group as { odds?: unknown }).odds)
			) {
				odds.push(
					...((group as { odds: StoredBetOdd[] }).odds),
				);
			}
		}
	}
	return odds;
}

export async function loadMarketDefinitions(
	env: CloudflareBindings,
	typeIds: string[],
	fetchImpl: typeof fetch = fetch,
): Promise<Map<string, MarketDefinition>> {
	const defs = new Map<string, MarketDefinition>();
	const base = sportsbookApiBase(env);
	const secret = env.PROXY_SECRET?.trim();
	if (!base || !secret || typeIds.length === 0) return defs;

	const unique = [...new Set(typeIds.filter(Boolean))];
	await Promise.all(
		unique.map(async (typeId) => {
			try {
				const response = await fetchImpl(`${base}/v2/markets/${typeId}`, {
					method: "GET",
					headers: {
						Accept: "application/json",
						"X-Proxy-Auth": secret,
					},
				});
				if (!response.ok) return;
				const body = (await response.json()) as {
					data?: { market?: MarketDefinition };
				};
				const market = body.data?.market;
				if (market) defs.set(String(typeId), market);
			} catch {
				// Ticket still renders; labels stay null when the dictionary misses.
			}
		}),
	);
	return defs;
}
