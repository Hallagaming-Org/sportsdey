import crypto from "node:crypto";
import { hashPassword } from "../auth/admin";

const args = process.argv.slice(2);

// Optional first argument is env; if absent, default to staging and shift args
let env: "production" | "staging" = "staging";
let argOffset = 0;
if (args[0] === "production" || args[0] === "staging") {
	env = args[0];
	argOffset = 1;
}

const email = args[argOffset] || "admin@sportsdey.com";
const password = args[argOffset + 1];
const name = args[argOffset + 2] || "Super Admin";
const role = (args[argOffset + 3] as "super_admin" | "admin") || "super_admin";

if (!password) {
	console.error(
		"Usage: pnpm admin:create [env] <email> <password> [name] [role]",
	);
	console.error(
		"Example: pnpm admin:create staging admin@sportsdey.com mypassword123 'Super Admin' super_admin",
	);
	process.exit(1);
}

async function main() {
	const passwordHash = await hashPassword(password);
	const id = crypto.randomUUID();
	const now = Date.now();

	// Escape single quotes for safe SQL literal usage
	const esc = (value: string) => value.replace(/'/g, "''");

	console.log(`Creating admin in ${env} database...`);
	console.log(`Password hash generated: ${passwordHash.substring(0, 20)}...`);
	console.log(`Admin ID: ${id}`);

	const sql = `INSERT INTO admin (id, email, password_hash, name, mobile_number, image, role, created_at, updated_at) VALUES ('${esc(id)}', '${esc(email)}', '${esc(passwordHash)}', '${esc(name)}', NULL, NULL, '${esc(role)}', ${now}, ${now});`;

	// D1 database names from wrangler.jsonc
	const dbName = env === "production" ? "sportsdey_db" : "staging-db";

	console.log(`SQL ready to execute on remote ${env} database`);
	console.log("Please run this command manually:");
	console.log(`npx wrangler d1 execute ${dbName} --command "${sql}" --remote`);
}

main().catch(console.error);
