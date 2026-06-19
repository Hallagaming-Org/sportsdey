import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
if (args[0] === "production" || args[0] === "staging") {
	env = args[0];
}

const NIGERIAN_BANKS = [
	{ code: "058", name: "GTBank" },
	{ code: "044", name: "Access Bank" },
	{ code: "011", name: "First Bank" },
	{ code: "033", name: "United Bank For Africa" },
	{ code: "057", name: "Zenith Bank" },
	{ code: "035", name: "Wema Bank" },
	{ code: "050", name: "Ecobank" },
	{ code: "070", name: "Fidelity Bank" },
	{ code: "221", name: "Stanbic IBTC Bank" },
	{ code: "214", name: "FCMB" },
];

const NAMES = [
	"John Okafor",
	"Blessing Adeyemi",
	"Chinedu Obi",
	"Aisha Bello",
	"Emeka Nwosu",
];

const EMAILS = [
	"john.okafor@example.com",
	"blessing.adeyemi@example.com",
	"chinedu.obi@example.com",
	"aisha.bello@example.com",
	"emeka.nwosu@example.com",
];

const ACCOUNT_NUMBERS = [
	"0123456789",
	"0234567890",
	"0345678901",
	"0456789012",
	"0567890123",
];

const WITHDRAWAL_AMOUNTS = [
	5000, 10000, 25000, 15000, 50000,
	8000, 20000, 35000, 12000, 75000,
];

const WALLET_BALANCES = [
	100000, 50000, 200000, 75000, 150000,
];

function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

function generateReference(): string {
	return `wd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateTxnId(): string {
	return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function runWrangler(sql: string, dbName: string, label: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const timestamp = Date.now();
		const tempFile = path.join(os.tmpdir(), `seed-withdrawals-${timestamp}-${label}.sql`);
		fs.writeFileSync(tempFile, sql);

		const cmd = `npx wrangler d1 execute ${dbName} --file "${tempFile}" --remote --env ${env}`;
		console.log(`Running: ${label}...`);

		exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
			try { fs.unlinkSync(tempFile); } catch {}
			if (error) {
				reject(new Error(`Failed to ${label}: ${error.message}`));
				return;
			}
			const lines = stdout.trim().split("\n").filter(Boolean);
			const resultLine = lines.find(l => l.includes("rows") || l.includes("error"));
			console.log(`  ${resultLine || "done"}`);
			resolve();
		});
	});
}

async function main() {
	const now = Date.now();

	const userIds = Array.from({ length: 5 }, () => crypto.randomUUID());
	const walletIds = Array.from({ length: 5 }, () => crypto.randomUUID());
	const withdrawalAccountIds = Array.from({ length: 5 }, () => crypto.randomUUID());

	const userRows = userIds.map((uid, i) =>
		`(${escape(uid)}, ${escape(NAMES[i])}, ${escape(EMAILS[i])}, 1, NULL, ${escape("NG")}, ${escape("+234800000000" + (i + 1))}, ${now}, ${now}, ${escape("approved")}, 0)`,
	).join(",\n");

	const walletRows = userIds.map((uid, i) =>
		`(${escape(walletIds[i])}, ${escape(uid)}, ${WALLET_BALANCES[i] * 100}, 0, ${now}, ${now})`,
	).join(",\n");

	const withdrawalAccountRows = userIds.map((uid, i) => {
		const bank = NIGERIAN_BANKS[i];
		return `(${escape(withdrawalAccountIds[i])}, ${escape(uid)}, ${escape(bank.code)}, ${escape(bank.name)}, ${escape(ACCOUNT_NUMBERS[i])}, ${escape(NAMES[i])}, ${now}, ${now})`;
	}).join(",\n");

	const devices = ["mobile", "desktop", "mobile", "desktop", "mobile"];
	const locations = ["Lagos, Nigeria", "Abuja, Nigeria", "Port Harcourt, Nigeria", "Ibadan, Nigeria", "Enugu, Nigeria"];
	const channels = ["mobile_app", "web", "web", "mobile_app", "web"];

	const withdrawalRows = Array.from({ length: 10 }, (_, i) => {
		const userIdx = i % 5;
		const uid = userIds[userIdx];
		const bank = NIGERIAN_BANKS[i % NIGERIAN_BANKS.length];
		const amountKobo = WITHDRAWAL_AMOUNTS[i] * 100;
		const walletBalance = WALLET_BALANCES[userIdx] * 100;

		const metadata = {
			destinationBank: NAMES[userIdx],
			bankCode: bank.code,
			accountNumber: ACCOUNT_NUMBERS[userIdx],
			accountName: NAMES[userIdx],
			balanceBefore: walletBalance,
			ipAddress: i % 2 === 0 ? "192.168.1.100" : "10.0.0.50",
			device: devices[userIdx],
			location: locations[userIdx],
			transactionChannel: channels[userIdx],
			feesAmount: 0,
		};

		const txnId = generateTxnId();
		const ref = generateReference();

		return `(${escape(txnId)}, ${escape(uid)}, ${amountKobo}, ${escape("debit")}, ${escape(ref)}, ${escape("pending_approval")}, ${escape("bank_transfer")}, NULL, NULL, ${walletBalance}, ${escape(JSON.stringify(metadata))}, ${now + i * 60000})`;
	}).join(",\n");

	const userSql = `INSERT INTO user (id, name, email, email_verified, image, country, mobile_number, created_at, updated_at, verification_status, suspended) VALUES\n${userRows};`;
	const walletSql = `INSERT INTO wallet (id, user_id, balance, frozen_balance, created_at, updated_at) VALUES\n${walletRows};`;
	const withdrawalAccountSql = `INSERT INTO withdrawal_account (id, user_id, bank_code, bank_name, account_number, account_name, created_at, updated_at) VALUES\n${withdrawalAccountRows};`;
	const withdrawalSql = `INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, recipient_wallet_id, recipient_name, balance, metadata, created_at) VALUES\n${withdrawalRows};`;

	const dbName = env === "production" ? "sportsdey_db" : "staging-db";

	console.log(`Seeding dummy withdrawals in ${env} database...`);

	try {
		await runWrangler(userSql, dbName, "insert users");
		await runWrangler(walletSql, dbName, "insert wallets");
		await runWrangler(withdrawalAccountSql, dbName, "insert withdrawal accounts");
		await runWrangler(withdrawalSql, dbName, "insert pending withdrawal transactions");

		console.log("\nDone! Seeded:");
		console.log("  - 5 users (verified, with wallets)");
		console.log("  - 5 withdrawal accounts");
		console.log("  - 10 pending withdrawal transactions");
	} catch (error) {
		console.error("\nError:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

main();
