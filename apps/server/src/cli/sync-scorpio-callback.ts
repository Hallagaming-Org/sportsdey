/**
 * Point the shared Scorpio operator callbackURL at staging or production.
 *
 * Scorpio allows only ONE callback URL per operator. Staging and production
 * share the same operator token — setting staging breaks prod seamless wallet
 * (balance → ERR_INVALID_PLAYER_ID → Amusnet "connection lost").
 *
 * Usage:
 *   pnpm exec tsx src/cli/sync-scorpio-callback.ts production
 *   pnpm exec tsx src/cli/sync-scorpio-callback.ts staging
 *   pnpm exec tsx src/cli/sync-scorpio-callback.ts status
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	ensureScorpioOperatorCallback,
	getOperatorInfo,
	getScorpioConfig,
} from "../utils/scorpio";
import {
	loadScorpioSettings,
	normalizeScorpioCallbackUrl,
} from "../utils/scorpio-config";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../..");
const mode = (process.argv[2] || "status").toLowerCase();

function loadDevVars(): Record<string, string> {
	const file = path.join(root, ".dev.vars");
	if (!fs.existsSync(file)) {
		throw new Error(`Missing ${file}`);
	}
	const out: Record<string, string> = {};
	for (const line of fs.readFileSync(file, "utf8").split("\n")) {
		if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
		const key = line.slice(0, line.indexOf("=")).trim();
		const val = line.slice(line.indexOf("=") + 1).trim();
		out[key] = val;
	}
	return out;
}

const TARGETS: Record<string, string> = {
	production: "https://api.sportsdey.com/scorpio/callback",
	prod: "https://api.sportsdey.com/scorpio/callback",
	staging: "https://staging-api.sportsdey.com/scorpio/callback",
};

async function main() {
	const vars = loadDevVars();
	const env = {
		SCORPIO_API_URL: vars.SCORPIO_API_URL || vars.SCORPIO_BASE_URL,
		SCORPIO_BASE_URL: vars.SCORPIO_BASE_URL || vars.SCORPIO_API_URL,
		SCORPIO_API_TOKEN: vars.SCORPIO_API_TOKEN,
		SCORPIO_CALLBACK_URL: vars.SCORPIO_CALLBACK_URL,
	};

	const config = getScorpioConfig(env);
	const info = await getOperatorInfo(config);
	const current = normalizeScorpioCallbackUrl(
		String(info.callbackURL ?? info.callbackUrl ?? ""),
	);
	console.log(`Operator callbackURL (live): ${current || "(empty)"}`);

	if (mode === "status") {
		const settings = loadScorpioSettings(env);
		console.log(
			`.dev.vars SCORPIO_CALLBACK_URL: ${settings.callbackUrl || "(empty)"}`,
		);
		return;
	}

	const desired = TARGETS[mode];
	if (!desired) {
		console.error(`Unknown mode "${mode}". Use: status | production | staging`);
		process.exit(1);
	}

	const result = await ensureScorpioOperatorCallback(
		{ ...env, SCORPIO_CALLBACK_URL: desired },
		{ force: true },
	);
	console.log(
		result.synced
			? `Updated callbackURL: ${result.from} → ${result.to}`
			: `Already set to ${desired}`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
