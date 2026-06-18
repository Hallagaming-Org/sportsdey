import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
}

interface DriveListResponse {
	files: DriveFile[];
	nextPageToken?: string;
}

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
let concurrency = 5;

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg.startsWith("--concurrency=")) {
		concurrency = Number.parseInt(arg.replace("--concurrency=", ""), 10);
	}
}

const envFile = env === "production" ? ".env.production" : ".env.staging";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (
	!GOOGLE_DRIVE_API_KEY ||
	!GOOGLE_DRIVE_FOLDER_ID ||
	!R2_ACCESS_KEY_ID ||
	!R2_SECRET_ACCESS_KEY ||
	!R2_ENDPOINT ||
	!R2_BUCKET_NAME ||
	!R2_PUBLIC_URL
) {
	console.error("Error: Missing required environment variables.");
	console.error(
		"Required: GOOGLE_DRIVE_API_KEY, GOOGLE_DRIVE_FOLDER_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL",
	);
	process.exit(1);
}

const r2Client = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

async function listDriveFiles(): Promise<DriveFile[]> {
	const allFiles: DriveFile[] = [];
	let pageToken: string | undefined;

	do {
		const params = new URLSearchParams({
			q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
			pageSize: "1000",
			fields: "files(id,name,mimeType),nextPageToken",
			key: GOOGLE_DRIVE_API_KEY!,
		});
		if (pageToken) {
			params.set("pageToken", pageToken);
		}

		const url = `${DRIVE_API_BASE}/files?${params.toString()}`;
		const response = await fetch(url);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(
				`Drive API list failed: ${response.status} ${response.statusText}\n${text}`,
			);
		}

		const data = (await response.json()) as DriveListResponse;
		allFiles.push(...data.files);
		pageToken = data.nextPageToken;
		console.log(
			`Listed ${data.files.length} files (total: ${allFiles.length})${
				pageToken ? ", more pages..." : ""
			}`,
		);
	} while (pageToken);

	return allFiles;
}

async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
	const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`;
	const response = await fetch(url);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Drive API download failed: ${response.status} ${response.statusText}\n${text}`,
		);
	}

	return response.arrayBuffer();
}

async function uploadToR2(
	key: string,
	data: ArrayBuffer,
	mimeType: string,
): Promise<void> {
	await r2Client.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: new Uint8Array(data),
			ContentType: mimeType || "application/octet-stream",
		}),
	);
}

async function getExistingNames(): Promise<Set<string>> {
	const usedDbName =
		env === "production" ? "sportsdey_db" : "staging-db";

	const { exec } = await import("node:child_process");

	return new Promise((resolve) => {
		exec(
			`npx wrangler d1 execute ${usedDbName} --command "SELECT name FROM gdrive_file" --remote --env ${env}`,
			(error, stdout) => {
				if (error) {
					console.log(
						"Could not fetch existing files, proceeding without duplicate check",
					);
					console.log("Error:", error.message);
					resolve(new Set());
					return;
				}

				const names = new Set<string>();
				for (const line of stdout.trim().split("\n")) {
					const trimmed = line.trim();
					if (trimmed && !trimmed.includes("name")) {
						names.add(trimmed);
					}
				}
				console.log(`Found ${names.size} existing files in database`);
				resolve(names);
			},
		);
	});
}

type ProcessResult =
	| { status: "success"; name: string; imageUrl: string }
	| { status: "failed"; name: string; error: string };

async function main() {
	console.log(`Syncing files from Google Drive to R2 (${env} environment)...`);
	console.log(`Concurrency: ${concurrency}`);
	console.log("");

	console.log("Listing files from Google Drive folder...");
	const allFiles = await listDriveFiles();
	console.log(`Total files in Drive folder: ${allFiles.length}`);
	console.log("");

	const existingNames = await getExistingNames();

	const newFiles = allFiles.filter((f) => !existingNames.has(f.name));
	console.log(`New files to upload: ${newFiles.length}`);
	console.log(`Already in database: ${allFiles.length - newFiles.length}`);
	console.log("");

	if (newFiles.length === 0) {
		console.log("No new files to upload.");
		return;
	}

	const results: ProcessResult[] = [];
	let completed = 0;
	const total = newFiles.length;

	async function processFile(
		file: DriveFile,
	): Promise<ProcessResult> {
		try {
			console.log(`[${completed + 1}/${total}] Downloading: ${file.name}`);
			const data = await downloadDriveFile(file.id);

			const key = `gdrive-files/${file.name}`;
			console.log(`[${completed + 1}/${total}] Uploading: ${file.name}`);
			await uploadToR2(key, data, file.mimeType);

			const imageUrl = `${R2_PUBLIC_URL}/${key}`;
			return { status: "success", name: file.name, imageUrl };
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Unknown error";
			console.error(`[${completed + 1}/${total}] Failed: ${file.name} - ${message}`);
			return { status: "failed", name: file.name, error: message };
		}
	}

	async function worker(): Promise<void> {
		while (true) {
			const index = completed++;
			if (index >= total) break;
			const file = newFiles[index];
			const result = await processFile(file);
			results[index] = result;
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
		worker(),
	);
	await Promise.all(workers);

	const succeeded = results.filter((r) => r.status === "success") as Extract<
		ProcessResult,
		{ status: "success" }
	>[];
	const failed = results.filter((r) => r.status === "failed") as Extract<
		ProcessResult,
		{ status: "failed" }
	>[];

	console.log("\n========================================");
	console.log(`Total: ${total}`);
	console.log(`Succeeded: ${succeeded.length}`);
	console.log(`Failed: ${failed.length}`);
	console.log("");

	if (failed.length > 0) {
		console.log("Failed files:");
		for (const f of failed) {
			console.log(`  - ${f.name}: ${f.error}`);
		}
	}

	if (succeeded.length === 0) {
		console.log("No files to insert into database.");
		return;
	}

	console.log("\nGenerating SQL for database insertion...");

	const batchSize = 100;
	const timestamp = Date.now();
	const usedDbName =
		env === "production" ? "sportsdey_db" : "staging-db";

	const totalBatches = Math.ceil(succeeded.length / batchSize);
	const { exec } = await import("node:child_process");
	let inserted = 0;

	for (let i = 0; i < succeeded.length; i += batchSize) {
		const batch = succeeded.slice(i, i + batchSize);
		const batchValues = batch
			.map(
				(file) =>
					`(${escape(crypto.randomUUID())}, ${escape(file.name)}, ${escape(file.imageUrl)}, ${timestamp})`,
			)
			.join(",\n");
		const sql = `INSERT INTO gdrive_file (id, name, image_url, created_at) VALUES ${batchValues};`;
		const batchNum = Math.floor(i / batchSize) + 1;

		const tempFile = path.join(
			os.tmpdir(),
			`sync-gdrive-${timestamp}-${batchNum}.sql`,
		);
		fs.writeFileSync(tempFile, sql);

		try {
			await new Promise<void>((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env ${env}`;
				exec(cmd, { timeout: 120000 }, (error) => {
					try {
						fs.unlinkSync(tempFile);
					} catch {}
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			});
			inserted += batch.length;
			console.log(
				`Batch ${batchNum}/${totalBatches}: ${inserted} files inserted`,
			);
		} catch (err) {
			console.error(`Batch ${batchNum} failed:`, err);
		}
	}

	console.log(`\nDone! Inserted ${inserted} file records.`);
}

function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
