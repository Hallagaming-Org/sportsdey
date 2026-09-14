import assert from "node:assert/strict";
import { BONUS_ENGINE_FALLBACK_CASINO_PROVIDER } from "./bonus-engine.service.constant";
import {
	casinoBetAmountFromKobo,
	optionalExecutionCtx,
	resolveCasinoBetIdentity,
} from "./casino-bet.service";
import {
	BONUS_ENGINE_NATIVE_CASINO_PROVIDERS,
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	nativeCasinoProviderByGameCode,
	nativeCasinoProviderById,
} from "./casino-catalog.constant";

// A Slotegrator row owns its provider id; `id` and `code` are both the uuid.
const slotegrator = resolveCasinoBetIdentity({
	gameRef: "b1f2c3d4",
	catalogGame: { id: "b1f2c3d4", code: "b1f2c3d4", providerId: "982" },
});
assert.equal(slotegrator.providerId, "982");
assert.equal(slotegrator.gameId, "b1f2c3d4");

// A seeded row has no provider metadata, so the native catalog resolves it and
// `gameId` must be the code Admin sees in `listBonusEngineGames`.
const lagosRush = resolveCasinoBetIdentity({
	gameRef: "LAGOSRUSH",
	catalogGame: { id: "3f0a-uuid", code: "LAGOSRUSH", providerId: null },
	fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
});
assert.equal(lagosRush.providerId, BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH);
assert.equal(lagosRush.gameId, "LAGOSRUSH");

// Thndr sends its own game id; a catalog miss still resolves off the code.
const thndr = resolveCasinoBetIdentity({
	gameRef: "plinko",
	catalogGame: null,
	fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.THNDR,
});
assert.equal(thndr.providerId, BONUS_ENGINE_NATIVE_PROVIDER_ID.THNDR);
assert.equal(thndr.gameId, "plinko");

// Halla callbacks carry no game code: provider-level report, no game id.
const halla = resolveCasinoBetIdentity({
	fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.HALLA,
});
assert.equal(halla.providerId, BONUS_ENGINE_NATIVE_PROVIDER_ID.HALLA);
assert.equal(halla.gameId, undefined);

// An unknown game with no route fallback must not silently claim a provider.
const unknown = resolveCasinoBetIdentity({ gameRef: "mystery-game" });
assert.equal(
	unknown.providerId,
	BONUS_ENGINE_FALLBACK_CASINO_PROVIDER.uniqueId,
);
assert.equal(unknown.gameId, "mystery-game");

// An empty provider id in D1 must not win over the native catalog.
const blankProvider = resolveCasinoBetIdentity({
	gameRef: "XCAPEHB",
	catalogGame: { id: "uuid", code: "XCAPEHB", providerId: "  " },
	fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LUCKYWORLD,
});
assert.equal(
	blankProvider.providerId,
	BONUS_ENGINE_NATIVE_PROVIDER_ID.LUCKYWORLD,
);

assert.equal(
	nativeCasinoProviderByGameCode("lagosrush")?.uniqueId,
	BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
);
assert.equal(nativeCasinoProviderByGameCode("")?.uniqueId, undefined);
assert.equal(nativeCasinoProviderById("nope"), undefined);

// One code must never be claimed by two providers, or reports would flap.
const seenCodes = new Set<string>();
for (const provider of BONUS_ENGINE_NATIVE_CASINO_PROVIDERS) {
	assert.equal(nativeCasinoProviderById(provider.uniqueId), provider);
	for (const code of provider.gameCodes) {
		const key = code.toLowerCase();
		assert.equal(seenCodes.has(key), false, `duplicate game code ${code}`);
		seenCodes.add(key);
		assert.equal(nativeCasinoProviderByGameCode(code), provider);
	}
}

assert.equal(casinoBetAmountFromKobo(150_000), 1500);
assert.equal(casinoBetAmountFromKobo(55), 0.55);
assert.equal(casinoBetAmountFromKobo(0), 0);

// Hono throws when a request arrived without an ExecutionContext; reading it
// must degrade to awaiting rather than 500ing the provider's wallet callback.
const waitUntil = () => undefined;
assert.equal(
	optionalExecutionCtx({ executionCtx: { waitUntil } })?.waitUntil,
	waitUntil,
);
assert.equal(optionalExecutionCtx({}), undefined);
assert.equal(optionalExecutionCtx(undefined), undefined);
assert.equal(optionalExecutionCtx({ executionCtx: {} }), undefined);
assert.equal(
	optionalExecutionCtx({
		get executionCtx(): never {
			throw new Error("This context has no ExecutionContext");
		},
	}),
	undefined,
);

console.log("bonus-engine casino-bet.self-check: ok");
