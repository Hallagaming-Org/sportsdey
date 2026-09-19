import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertSwipeGamesCallbackIp,
	getSwipeGamesConfig,
	SWIPEGAMES_PRODUCTION_CALLBACK_IPS,
	SWIPEGAMES_STAGING_CALLBACK_IPS,
	SwipeGamesIpForbiddenError,
} from "./config";

const keys = {
	SWIPEGAMES_CID: "cid",
	SWIPEGAMES_EXT_CID: "sportsdey",
	SWIPEGAMES_API_KEY: "outbound-key",
	SWIPEGAMES_INTEGRATION_API_KEY: "integration-key",
};

describe("Swipe Games reverse-call IP allowlist", () => {
	it("defaults staging to the published Swipe Games staging IP", () => {
		const config = getSwipeGamesConfig({ ...keys, SWIPEGAMES_ENV: "staging" });
		assert.deepEqual(config?.allowedIps, [...SWIPEGAMES_STAGING_CALLBACK_IPS]);
		assert.equal(config?.ipRestrictionEnabled, true);
	});

	it("defaults production to the published Swipe Games production IP", () => {
		const config = getSwipeGamesConfig({
			...keys,
			SWIPEGAMES_ENV: "production",
		});
		assert.deepEqual(config?.allowedIps, [...SWIPEGAMES_PRODUCTION_CALLBACK_IPS]);
	});

	it("allows the published staging IP and rejects others", () => {
		const config = getSwipeGamesConfig({ ...keys, SWIPEGAMES_ENV: "staging" });
		assert.ok(config);
		assert.doesNotThrow(() =>
			assertSwipeGamesCallbackIp("18.185.156.20", config),
		);
		assert.throws(
			() => assertSwipeGamesCallbackIp("1.2.3.4", config),
			SwipeGamesIpForbiddenError,
		);
		assert.throws(
			() => assertSwipeGamesCallbackIp("3.65.138.8", config),
			SwipeGamesIpForbiddenError,
		);
	});

	it("can be disabled with off", () => {
		const config = getSwipeGamesConfig({
			...keys,
			SWIPEGAMES_ENV: "staging",
			SWIPEGAMES_ALLOWED_IPS: "off",
		});
		assert.ok(config);
		assert.equal(config.ipRestrictionEnabled, false);
		assert.doesNotThrow(() => assertSwipeGamesCallbackIp("1.2.3.4", config));
	});
});
