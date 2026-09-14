/**
 * Bonus Engine Admin dropdowns for casino providers/games.
 *
 * The contract these tests pin down: whatever Admin can pick here must be
 * exactly what the provider callbacks report on `POST /bet`, and adding a game
 * must not require a code change. `unique_id` is therefore always `game.code`,
 * and a provider is resolved from D1 metadata first, native catalog second.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, it } from "node:test";
import { createMemoryD1 } from "../../test-support/memory-d1";
import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_NATIVE_PROVIDER_ID } from "./casino-catalog.constant";
import {
	listBonusEngineGameProviders,
	listBonusEngineGames,
} from "./reference-data.service";

let sqlite: DatabaseSync;
let env: CloudflareBindings;

function insertGame(row: {
	id: string;
	name: string;
	code: string;
	providerId?: string | null;
	providerName?: string | null;
	enabled?: boolean;
	isLiveGame?: boolean;
}) {
	sqlite
		.prepare(
			`INSERT INTO game
			 (id, name, code, provider_id, provider_name, is_live_game, free_spin, enabled)
			 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
		)
		.run(
			row.id,
			row.name,
			row.code,
			row.providerId ?? null,
			row.providerName ?? null,
			row.isLiveGame ? 1 : 0,
			row.enabled === false ? 0 : 1,
		);
}

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		CREATE TABLE game (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			code text NOT NULL,
			image_url text,
			provider_id text,
			provider_name text,
			is_live_game integer NOT NULL DEFAULT 0,
			free_spin integer NOT NULL DEFAULT 0,
			enabled integer NOT NULL DEFAULT 1,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
	`);
	const { DB } = createMemoryD1(sqlite);
	env = { DB } as unknown as CloudflareBindings;
});

describe("Bonus Engine casino reference data", () => {
	it("lists Slotegrator and Sportsdey-hosted providers together", async () => {
		insertGame({
			id: "uuid-slot-1",
			name: "Book of Dead",
			code: "uuid-slot-1",
			providerId: "982",
			providerName: "Play'n GO",
		});
		insertGame({
			id: "row-lagos",
			name: "Lagos Rush",
			code: "LAGOSRUSH",
			providerId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
			providerName: "Lagos Rush",
		});
		// Seeded before provider metadata existed — native catalog must cover it.
		insertGame({ id: "row-halla", name: "Halla Bomb", code: "HALLABOMB" });

		const providers = await listBonusEngineGameProviders(env);
		const ids = providers.map((provider) => provider.unique_id).sort();
		assert.deepEqual(ids, [
			"982",
			BONUS_ENGINE_NATIVE_PROVIDER_ID.HALLA,
			BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
		]);
	});

	it("reports game unique_id as game.code so Admin matches the bet report", async () => {
		insertGame({
			id: "uuid-slot-1",
			name: "Book of Dead",
			code: "uuid-slot-1",
			providerId: "982",
			providerName: "Play'n GO",
		});
		insertGame({
			id: "row-lagos-random-uuid",
			name: "Lagos Rush",
			code: "LAGOSRUSH",
			providerId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
			providerName: "Lagos Rush",
		});

		const games = await listBonusEngineGames({ env });
		const lagos = games.find((game) => game.name === "Lagos Rush");
		// Not the random D1 row id — the code, which is what /bet sends.
		assert.equal(lagos?.unique_id, "LAGOSRUSH");
		assert.equal(
			lagos?.provider_unique_id,
			BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
		);

		const slot = games.find((game) => game.name === "Book of Dead");
		assert.equal(slot?.unique_id, "uuid-slot-1");
		assert.equal(slot?.provider_unique_id, "982");
	});

	it("lists a brand-new provider and game with no code change", async () => {
		// A provider nobody hardcoded anywhere: it only needs D1 metadata.
		insertGame({
			id: "row-future",
			name: "Future Game",
			code: "FUTUREGAME",
			providerId: "future-studio",
			providerName: "Future Studio",
		});

		const providers = await listBonusEngineGameProviders(env);
		assert.equal(
			providers.some((provider) => provider.unique_id === "future-studio"),
			true,
		);

		const games = await listBonusEngineGames({
			env,
			gameProvider: "future-studio",
		});
		assert.deepEqual(games, [
			{
				provider_unique_id: "future-studio",
				name: "Future Game",
				unique_id: "FUTUREGAME",
				free_spin: 0,
			},
		]);
	});

	it("filters by a Sportsdey-hosted provider id", async () => {
		insertGame({
			id: "uuid-slot-1",
			name: "Book of Dead",
			code: "uuid-slot-1",
			providerId: "982",
			providerName: "Play'n GO",
		});
		insertGame({ id: "row-bomb", name: "Halla Bomb", code: "HALLABOMB" });
		insertGame({ id: "row-dice", name: "Halla Dice", code: "HALLADICE" });

		const games = await listBonusEngineGames({
			env,
			gameProvider: BONUS_ENGINE_NATIVE_PROVIDER_ID.HALLA,
		});
		assert.deepEqual(games.map((game) => game.unique_id).sort(), [
			"HALLABOMB",
			"HALLADICE",
		]);
	});

	it("omits disabled games and games with no resolvable provider", async () => {
		insertGame({
			id: "row-off",
			name: "Lagos Rush",
			code: "LAGOSRUSH",
			providerId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
			providerName: "Lagos Rush",
			enabled: false,
		});
		insertGame({ id: "row-orphan", name: "Mystery", code: "MYSTERY" });

		assert.deepEqual(await listBonusEngineGames({ env }), []);
		assert.deepEqual(await listBonusEngineGameProviders(env), []);
	});

	it("marks a provider live when any of its games is live", async () => {
		insertGame({
			id: "uuid-live",
			name: "Live Roulette",
			code: "uuid-live",
			providerId: "77",
			providerName: "Evolution",
			isLiveGame: true,
		});
		insertGame({
			id: "uuid-slot",
			name: "Slot",
			code: "uuid-slot",
			providerId: "77",
			providerName: "Evolution",
		});

		const providers = await listBonusEngineGameProviders(env);
		assert.equal(providers.length, 1);
		assert.equal(providers[0]?.is_live_game, 1);
	});
});
