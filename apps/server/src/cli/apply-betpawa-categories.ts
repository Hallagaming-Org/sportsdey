/**
 * Apply casino_games_betpawa.json onto remote D1 (BetPawa sheet categories).
 *
 * Usage: pnpm games:apply-betpawa-categories staging|production
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(dir, "casino_games_betpawa.json");
const env = process.argv[2] === "production" ? "production" : "staging";

process.argv = [process.argv[0], process.argv[1], env, jsonPath];
await import("./apply-sheet-categories.js");
