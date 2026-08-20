import { sql } from "drizzle-orm";
import { createDb } from "../../db";
import * as schema from "../../db/schema";
import type { CloudflareBindings } from "../../types";

type SlotegratorGameItem = {
	uuid: string;
	name: string;
	image?: string;
	type?: string;
	provider: string;
	provider_id: number;
	has_freespins?: number;
	label?: string;
};

type SlotegratorGamesResponse = {
	items?: SlotegratorGameItem[];
	_meta?: {
		pageCount?: number;
		totalCount?: number;
	};
};

export type CasinoCatalogSyncResult = {
	fetched: number;
	upserted: number;
	providers: number;
};

/**
 * Fetches the full Slotegrator mobile games catalog and upserts every row into
 * D1 with `provider_id` / `provider_name` populated. Runs inside the Worker so
 * Slotegrator IP allowlists that block local CLI hosts still succeed.
 */
export async function syncCasinoCatalogFromSlotegrator(
	env: CloudflareBindings,
): Promise<CasinoCatalogSyncResult> {
	const merchantKey = env.SLOTITEGRATION_MERCHANT_KEY;
	const merchantId = env.SLOTITEGRATION_MERCHANT_ID;
	const apiUrl = env.SLOTEGRATOR_API_URL?.replace(/\/$/, "");
	if (!merchantKey || !merchantId || !apiUrl) {
		throw new Error(
			"Slotegrator is not configured (SLOTITEGRATION_* / SLOTEGRATOR_API_URL)",
		);
	}

	const perPage = 50;
	const firstPage = await fetchSlotegratorGamesPage({
		apiUrl,
		merchantId,
		merchantKey,
		page: 1,
		perPage,
	});
	const pageCount = Math.max(1, firstPage._meta?.pageCount ?? 1);
	const games: Array<{
		id: string;
		name: string;
		imageUrl: string | null;
		providerId: string;
		providerName: string;
		isLiveGame: boolean;
		freeSpin: boolean;
	}> = [...mapSlotegratorGames(firstPage.items ?? [])];

	for (let page = 2; page <= pageCount; page += 1) {
		const pageData = await fetchSlotegratorGamesPage({
			apiUrl,
			merchantId,
			merchantKey,
			page,
			perPage,
		});
		games.push(...mapSlotegratorGames(pageData.items ?? []));
	}

	const db = createDb(env.DB);
	const now = new Date();
	const batchSize = 50;
	let upserted = 0;

	for (let index = 0; index < games.length; index += batchSize) {
		const batch = games.slice(index, index + batchSize);
		for (const game of batch) {
			await db
				.insert(schema.game)
				.values({
					id: game.id,
					name: game.name,
					code: game.id,
					imageUrl: game.imageUrl,
					providerId: game.providerId,
					providerName: game.providerName,
					isLiveGame: game.isLiveGame,
					freeSpin: game.freeSpin,
					enabled: true,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: schema.game.id,
					set: {
						name: game.name,
						code: game.id,
						imageUrl: game.imageUrl,
						providerId: game.providerId,
						providerName: game.providerName,
						isLiveGame: game.isLiveGame,
						freeSpin: game.freeSpin,
						enabled: true,
						updatedAt: now,
					},
				});
			upserted += 1;
		}
	}

	const providerRows = await db
		.select({
			providerId: schema.game.providerId,
		})
		.from(schema.game)
		.where(sql`${schema.game.providerId} IS NOT NULL AND ${schema.game.providerId} != ''`);

	const providers = new Set(
		providerRows
			.map((row) => row.providerId?.trim())
			.filter((value): value is string => Boolean(value)),
	);

	return {
		fetched: games.length,
		upserted,
		providers: providers.size,
	};
}

function mapSlotegratorGames(items: SlotegratorGameItem[]) {
	return items
		.filter((item) => item.uuid && item.provider && item.provider_id != null)
		.map((item) => {
			const type = item.type ?? "";
			const label = item.label ?? "";
			return {
				id: item.uuid,
				name: item.name,
				imageUrl: item.image?.trim() || null,
				providerId: String(item.provider_id),
				providerName: item.provider,
				isLiveGame: /\blive\b/i.test(type) || /\blive\b/i.test(label),
				freeSpin: Boolean(item.has_freespins),
			};
		});
}

/**
 * Signs and GETs one Slotegrator `/games/index` page (mobile filter).
 */
async function fetchSlotegratorGamesPage(payload: {
	apiUrl: string;
	merchantId: string;
	merchantKey: string;
	page: number;
	perPage: number;
}): Promise<SlotegratorGamesResponse> {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = crypto.randomUUID();
	const requestParams: Record<string, string> = {
		page: String(payload.page),
		per_page: String(payload.perPage),
		"filter[is_mobile]": "1",
	};
	const allParams: Record<string, string> = {
		...requestParams,
		"X-Merchant-Id": payload.merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};
	const sortedKeys = Object.keys(allParams).sort();
	const signParams = new URLSearchParams();
	for (const key of sortedKeys) {
		signParams.set(key, allParams[key] ?? "");
	}
	const cryptoMod = await import("node:crypto");
	const xSign = cryptoMod
		.createHmac("sha1", payload.merchantKey)
		.update(signParams.toString())
		.digest("hex");

	const urlParams = new URLSearchParams();
	for (const keyName of Object.keys(requestParams).sort()) {
		urlParams.set(keyName, requestParams[keyName] ?? "");
	}
	const response = await fetch(
		`${payload.apiUrl}/games/index?${urlParams.toString()}`,
		{
			method: "GET",
			headers: {
				"X-Merchant-Id": payload.merchantId,
				"X-Timestamp": timestamp,
				"X-Nonce": nonce,
				"X-Sign": xSign,
			},
		},
	);
	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Slotegrator games/index failed (${response.status}): ${body.slice(0, 200)}`,
		);
	}
	return (await response.json()) as SlotegratorGamesResponse;
}
