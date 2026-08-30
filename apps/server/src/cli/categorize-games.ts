import path from "node:path";
import { fileURLToPath } from "node:url";
import { categorizeGamesFromJson } from "./categorize-utils";

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
let jsonPath: string | null = null;
let remote = true;

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg.startsWith("--json=")) {
		jsonPath = arg.replace("--json=", "");
	} else if (arg === "--local") {
		remote = false;
	}
}

const dbName = env === "production" ? "sportsdey_db" : "staging-db";
const defaultJsonPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"casino_games.json",
);
const resolvedPath = jsonPath ?? defaultJsonPath;

categorizeGamesFromJson(dbName, env, resolvedPath, { remote }).catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
