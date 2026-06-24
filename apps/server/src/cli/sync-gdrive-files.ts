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
let concurrency = 3;
let batchSize = 10;
const RATE_LIMIT_DELAY = 200;

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg.startsWith("--concurrency=")) {
		concurrency = Number.parseInt(arg.replace("--concurrency=", ""), 10);
	} else if (arg.startsWith("--batch-size=")) {
		batchSize = Number.parseInt(arg.replace("--batch-size=", ""), 10);
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

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
	for (let attempt = 0; attempt < retries; attempt++) {
		const response = await fetch(url);

		if (response.ok) return response;

		if (response.status === 429 || response.status === 403) {
			const delay = Math.min(1000 * 2 ** attempt + Math.random() * 1000, 30_000);
			console.warn(
				`Rate limited (${response.status}), retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${retries})`,
			);
			await new Promise((r) => setTimeout(r, delay));
			continue;
		}

		const text = await response.text();
		throw new Error(
			`Drive API request failed: ${response.status} ${response.statusText}\n${text}`,
		);
	}

	throw new Error(`Drive API request failed after ${retries} retries`);
}

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
		const response = await fetchWithRetry(url);

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
	const response = await fetchWithRetry(url);
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

async function processBatch(
	batch: DriveFile[],
	batchNum: number,
	totalBatches: number,
): Promise<void> {
	const timestamp = Date.now();
	const succeeded: Array<{ name: string; imageUrl: string }> = [];
	const failed: Array<{ name: string; error: string }> = [];

	for (let i = 0; i < batch.length; i++) {
		const file = batch[i];
		try {
			console.log(`  [${i + 1}/${batch.length}] Downloading: ${file.name}`);
			const data = await downloadDriveFile(file.id);

			const key = `gdrive-files/${file.name}`;
			console.log(`  [${i + 1}/${batch.length}] Uploading: ${file.name}`);
			await uploadToR2(key, data, file.mimeType);

			const imageUrl = `${R2_PUBLIC_URL}/${key}`;
			succeeded.push({ name: file.name, imageUrl });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Unknown error";
			console.error(`  [${i + 1}/${batch.length}] Failed: ${file.name} - ${message}`);
			failed.push({ name: file.name, error: message });
		}
		await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY));
	}

	console.log(`  Batch ${batchNum}/${totalBatches}: ${succeeded.length} ok, ${failed.length} failed`);

	if (failed.length > 0) {
		for (const f of failed) {
			console.log(`    Failed: ${f.name} - ${f.error}`);
		}
	}

	if (succeeded.length === 0) {
		console.log(`  Skipping DB insert (no successful uploads in this batch)`);
		return;
	}

	const batchInsertSize = 100;
	const usedDbName =
		env === "production" ? "sportsdey_db" : "staging-db";
	const { exec } = await import("node:child_process");

	for (let i = 0; i < succeeded.length; i += batchInsertSize) {
		const insertBatch = succeeded.slice(i, i + batchInsertSize);
		const values = insertBatch
			.map(
				(f) =>
					`(${escape(crypto.randomUUID())}, ${escape(f.name)}, ${escape(f.imageUrl)}, ${timestamp})`,
			)
			.join(",\n");
		const sql = `INSERT INTO gdrive_file (id, name, image_url, created_at) VALUES ${values};`;

		const tempFile = path.join(
			os.tmpdir(),
			`sync-gdrive-${timestamp}-${batchNum}-${Math.floor(i / batchInsertSize) + 1}.sql`,
		);
		fs.writeFileSync(tempFile, sql);

		try {
			await new Promise<void>((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env ${env}`;
				exec(cmd, { timeout: 120000 }, (error) => {
					try {
						fs.unlinkSync(tempFile);
					} catch {}
					if (error) reject(error);
					else resolve();
				});
			});
		} catch (err) {
			console.error(`  DB insert sub-batch failed:`, err);
		}
	}
}

async function main() {
	console.log(`Syncing files from Google Drive to R2 (${env} environment)...`);
	console.log(`Concurrency: ${concurrency}, Batch size: ${batchSize}`);
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

	const totalBatches = Math.ceil(newFiles.length / batchSize);
	console.log(`Processing ${newFiles.length} files in ${totalBatches} batches of ${batchSize}`);
	console.log("");

	for (let i = 0; i < newFiles.length; i += batchSize) {
		const batch = newFiles.slice(i, i + batchSize);
		const batchNum = Math.floor(i / batchSize) + 1;
		console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} files) ---`);
		await processBatch(batch, batchNum, totalBatches);
	}

	console.log("\nDone! All batches complete.");
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
