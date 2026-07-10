import path from "node:path";
import { categorizeGamesFromJson } from "./categorize-utils";

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
let jsonPath: string | null = null;

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg.startsWith("--json=")) {
		jsonPath = arg.replace("--json=", "");
	}
}

const dbName = env === "production" ? "sportsdey_db" : "staging-db";
const defaultJsonPath = path.resolve(process.cwd(), "../../../casino_games.json");
const resolvedPath = jsonPath ?? defaultJsonPath;

categorizeGamesFromJson(dbName, env, resolvedPath).catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
