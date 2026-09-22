import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

function resolveLocalDbPath() {
	// Prefer the latest miniflare D1 sqlite created during `wrangler dev`
	const mfDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
	if (fs.existsSync(mfDir)) {
		const sqliteFiles = fs
			.readdirSync(mfDir)
			.filter((f) => f.endsWith(".sqlite"))
			.map((file) => ({
				file,
				mtime: fs.statSync(path.join(mfDir, file)).mtimeMs,
			}))
			.sort((a, b) => b.mtime - a.mtime);
		if (sqliteFiles.length > 0) {
			return path.join(mfDir, sqliteFiles[0].file);
		}
	}
	// Fallback to the checked-in prod DB placeholder (may be empty)
	return ".wrangler/state/v3/d1/d091e50e-e19f-40dc-ad77-e7050c7bbbad.sqlite";
}

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
	dialect: "sqlite",
	dbCredentials: process.env.CLOUDFLARE_DATABASE_ID
		? {
				accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
				databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
				token: process.env.CLOUDFLARE_D1_TOKEN!,
			}
		: {
				url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/66bbd296fc96c739ea5e99144fd0328a7a8d0ec85f88878beb314aaa7e307eba.sqlite",
			},
});
