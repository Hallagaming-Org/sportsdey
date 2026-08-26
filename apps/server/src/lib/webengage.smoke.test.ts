import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
	setWebengageUserAttributes,
	trackWebengageEvent,
} from "@/lib/webengage";
import {
	asEventNumber,
	buildWebengageUserPayload,
} from "@/utils/webengage-event";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function readRepo(relativePath: string) {
	return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("WebEngage audit smoke", () => {
	it("coerces Databet stake/odds strings to numbers (slip data type error)", () => {
		const stake = asEventNumber("180");
		const odds = asEventNumber("3.25424");
		assert.equal(typeof stake, "number");
		assert.equal(typeof odds, "number");
		assert.equal(stake, 180);
		assert.equal(odds, 3.25424);
		assert.equal(asEventNumber("tennis"), null);
		assert.equal(asEventNumber(""), null);
		assert.equal(asEventNumber(585.76), 585.76);
	});

	it("nests custom user attributes under attributes for the Users API", () => {
		const payload = buildWebengageUserPayload({
			userId: "k6sSXgXmhVARBZG93bNH5y6nCduqBHIO",
			email: "audit@example.com",
			firstName: "Audit",
			lastName: "User",
			wallet_balance: 49820,
			kyc_status: true,
		});
		assert.equal(payload.userId, "k6sSXgXmhVARBZG93bNH5y6nCduqBHIO");
		assert.equal(payload.email, "audit@example.com");
		assert.equal(payload.wallet_balance, undefined);
		assert.deepEqual(payload.attributes, {
			wallet_balance: 49820,
			kyc_status: true,
		});
		assert.equal(typeof (payload.attributes as { wallet_balance: number }).wallet_balance, "number");
	});

	it("POSTs nested user attributes and numeric event data through the Worker client", async () => {
		const bodies: { url: string; payload: Record<string, unknown> }[] = [];
		const originalFetch = globalThis.fetch;
		const pending: Promise<unknown>[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			bodies.push({
				url,
				payload: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
			});
			return new Response("{}", { status: 200 });
		}) as typeof fetch;

		const env = {
			WEBENGAGE_API_KEY: "test-key",
			WEBENGAGE_LICENSE_CODE: "ksa~aa13187c",
			WEBENGAGE_HOST: "https://api.webengage.test",
		};
		const executionCtx = {
			waitUntil(promise: Promise<unknown>) {
				pending.push(promise);
			},
		};

		try {
			setWebengageUserAttributes(
				env as never,
				{
					userId: "user-1",
					email: "a@b.co",
					firstName: "A",
					wallet_balance: 100.5,
					kyc_status: false,
				},
				executionCtx as never,
			);
			trackWebengageEvent(
				env as never,
				{
					userId: "user-1",
					eventName: "bet_slip_created",
					eventData: {
						stake_amount: asEventNumber("180"),
						odds_total: asEventNumber("3.25424"),
						wallet_id: "wallet-abc",
						sport: "tennis",
					},
				},
				executionCtx as never,
			);
			await Promise.all(pending);
		} finally {
			globalThis.fetch = originalFetch;
		}

		const userCall = bodies.find((item) => item.url.endsWith("/users"));
		const eventCall = bodies.find((item) => item.url.endsWith("/events"));
		assert.ok(userCall, "Users API was called");
		assert.ok(eventCall, "Events API was called");
		assert.deepEqual(userCall.payload.attributes, {
			wallet_balance: 100.5,
			kyc_status: false,
		});
		assert.equal(userCall.payload.wallet_balance, undefined);
		const eventData = eventCall.payload.eventData as Record<string, unknown>;
		assert.equal(eventCall.payload.eventName, "bet_slip_created");
		assert.equal(typeof eventData.stake_amount, "number");
		assert.equal(eventData.stake_amount, 180);
		assert.equal(typeof eventData.odds_total, "number");
		assert.equal(eventData.sport, "tennis");
		assert.equal(eventData.wallet_id, "wallet-abc");
	});

	it("website SDK compact/timestamp/match attrs omit empty strings and send Date timings", async () => {
		const tracked: Array<{ name: string; attrs?: Record<string, unknown> }> =
			[];
		let logoutCount = 0;
		const logins: string[] = [];
		(globalThis as { window?: unknown }).window = {
			webengage: {
				track(name: string, attrs?: Record<string, unknown>) {
					tracked.push({ name, attrs });
				},
				user: {
					login(id: string) {
						logins.push(id);
					},
					logout() {
						logoutCount += 1;
					},
					setAttribute() {},
				},
			},
		};
		(globalThis as { document?: { referrer: string } }).document = {
			referrer: "https://sportsdey.com/news",
		};

		const webengage = await import(
			"../../../web/src/lib/webengage.ts"
		);

		webengage.trackWebengageLoginInitiated("phone");
		webengage.loginWebengageUser("user-1");
		webengage.logoutWebengageUser();
		webengage.trackWebengageEvent("Profile Completed", {
			"First Name": "Ada",
			Country: "",
			"Reference Id": "",
		});
		webengage.trackWebengageEvent(
			"Match viewed",
			webengage.matchWebengageAttrs({
				match_id: "m1",
				sport: "football",
				league: "EPL",
				teams: "A vs B",
				timings: "2026-08-26T10:00:00.000Z",
				match_status: "live",
				match_score: "",
				match_time: "",
			}),
		);

		assert.equal(tracked[0]?.name, "User Login Initiated");
		assert.deepEqual(tracked[0]?.attrs, { Type: "phone" });
		assert.deepEqual(logins, ["user-1"]);
		assert.equal(logoutCount, 1);

		const profile = tracked.find((item) => item.name === "Profile Completed");
		assert.ok(profile);
		assert.equal(profile.attrs?.["First Name"], "Ada");
		assert.equal("Country" in (profile.attrs ?? {}), false);
		assert.equal("Reference Id" in (profile.attrs ?? {}), false);

		const match = tracked.find((item) => item.name === "Match viewed");
		assert.ok(match);
		assert.ok(match.attrs?.timings instanceof Date);
		assert.equal(match.attrs?.referrer, "https://sportsdey.com/news");
		assert.equal("match_score" in (match.attrs ?? {}), false);
	});

	it("keeps the audit event names and identity wiring in source", () => {
		const transferModal = readRepo("apps/web/src/components/transfer-modal.tsx");
		const wallet = readRepo("apps/server/src/routes/wallet.ts");
		const sportsbook = readRepo("apps/server/src/routes/sportsbook.ts");
		const authClient = readRepo("apps/web/src/lib/auth/client.ts");
		const cms = readRepo("apps/server/src/routes/cms.ts");
		const news = readRepo("apps/web/src/routes/news.$slug.tsx");
		const signIn = readRepo("apps/web/src/routes/auth/sign-in.tsx");
		const phone = readRepo("apps/web/src/routes/auth/phone-sign-in.tsx");

		assert.equal(transferModal.includes("transfer_funds initated"), false);
		assert.ok(transferModal.includes('"transfer_funds initiated"'));
		assert.ok(transferModal.includes('"transfer_funds_completed"'));
		assert.ok(wallet.includes('eventName: "transfer_funds initiated"'));
		assert.ok(wallet.includes('eventName: "transfer_funds_completed"'));
		assert.ok(sportsbook.includes("stake_amount: asEventNumber("));
		assert.ok(sportsbook.includes("odds_total: asEventNumber("));
		assert.ok(sportsbook.includes("wallet_id: wallet.id"));
		assert.ok(authClient.includes("logoutWebengageUser()"));
		assert.ok(signIn.includes("trackWebengageLoginInitiated(provider)"));
		assert.ok(phone.includes('trackWebengageLoginInitiated("phone")'));
		assert.ok(cms.includes("category: n.category"));
		assert.ok(cms.includes("category,"));
		assert.ok(news.includes("Time: new Date()"));
		assert.ok(news.includes("article_category: news.category"));
		assert.ok(news.includes("article_category: news?.category"));
	});
});
