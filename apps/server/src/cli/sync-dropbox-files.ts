import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

interface DropboxFileEntry {
	name: string;
	id: string;
}

interface DropboxListResponse {
	entries: Array<{
		[".tag"]: string;
		name: string;
		path_lower: string;
		id: string;
	}>;
	cursor: string;
	has_more: boolean;
}

const args = process.argv.slice(2);

let env: "production" | "staging" = "production";
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

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const DROPBOX_SHARED_LINK = process.env.DROPBOX_SHARED_LINK;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (
	!DROPBOX_ACCESS_TOKEN ||
	!DROPBOX_SHARED_LINK ||
	!R2_ACCESS_KEY_ID ||
	!R2_SECRET_ACCESS_KEY ||
	!R2_ENDPOINT ||
	!R2_BUCKET_NAME ||
	!R2_PUBLIC_URL
) {
	console.error("Error: Missing required environment variables.");
	console.error(
		"Required: DROPBOX_ACCESS_TOKEN, DROPBOX_SHARED_LINK, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL",
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

const DROPBOX_API_BASE = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_BASE = "https://content.dropboxapi.com/2";

async function dropboxFetch(
	url: string,
	options: RequestInit,
	retries = 3,
): Promise<Response> {
	for (let attempt = 0; attempt < retries; attempt++) {
		const response = await fetch(url, options);

		if (response.ok) return response;

		if (response.status === 429) {
			const delay = Math.min(
				1000 * 2 ** attempt + Math.random() * 1000,
				30_000,
			);
			console.warn(
				`Rate limited, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${retries})`,
			);
			await new Promise((r) => setTimeout(r, delay));
			continue;
		}

		const text = await response.text();
		throw new Error(
			`Dropbox API request failed: ${response.status} ${response.statusText}\n${text}`,
		);
	}

	throw new Error(`Dropbox API request failed after ${retries} retries`);
}

async function listDropboxFiles(): Promise<DropboxFileEntry[]> {
	const allFiles: DropboxFileEntry[] = [];
	let cursor: string | undefined;
	let hasMore = true;

	while (hasMore) {
		const url = cursor
			? `${DROPBOX_API_BASE}/files/list_folder/continue`
			: `${DROPBOX_API_BASE}/files/list_folder`;

		const body = cursor
			? JSON.stringify({ cursor })
			: JSON.stringify({
					path: "",
					shared_link: { url: DROPBOX_SHARED_LINK },
					recursive: false,
				});

		const response = await dropboxFetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
				"Content-Type": "application/json",
			},
			body,
		});

		const data = (await response.json()) as DropboxListResponse;

		for (const entry of data.entries) {
			if (entry[".tag"] === "file") {
				allFiles.push({
					name: entry.name,
					id: entry.id,
				});
			}
		}

		cursor = data.cursor;
		hasMore = data.has_more;
		console.log(
			`Listed ${data.entries.filter((e) => e[".tag"] === "file").length} files (total: ${allFiles.length})${hasMore ? ", more pages..." : ""}`,
		);
	}

	return allFiles;
}

async function downloadDropboxFile(
	pathLower: string,
): Promise<{ data: ArrayBuffer; mimeType: string }> {
	const response = await dropboxFetch(
		`${DROPBOX_CONTENT_BASE}/sharing/get_shared_link_file`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
				"Dropbox-API-Arg": JSON.stringify({
					url: DROPBOX_SHARED_LINK,
					path: pathLower,
				}),
			},
		},
	);

	const mimeType =
		response.headers.get("Content-Type") || "application/octet-stream";
	const data = await response.arrayBuffer();
	return { data, mimeType };
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
	const usedDbName = env === "production" ? "sportsdey_db" : "staging-db";

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
						names.add(normalizeName(trimmed));
					}
				}
				console.log(`Found ${names.size} existing files in database`);
				resolve(names);
			},
		);
	});
}

async function processBatch(
	batch: DropboxFileEntry[],
	batchNum: number,
	totalBatches: number,
	existingNames: Set<string>,
): Promise<void> {
	const timestamp = Date.now();
	const usedDbName = env === "production" ? "sportsdey_db" : "staging-db";
	const { exec } = await import("node:child_process");

	for (let i = 0; i < batch.length; i++) {
		const file = batch[i];
		if (!file) continue;

		const normalizedName = normalizeName(file.name);

		if (existingNames.has(normalizedName)) {
			console.log(
				`  [${i + 1}/${batch.length}] Skipping (already in DB): ${file.name}`,
			);
			continue;
		}

		try {
			console.log(`  [${i + 1}/${batch.length}] Downloading: ${file.name}`);
			const { data, mimeType } = await downloadDropboxFile(`/${file.name}`);

			const key = `gdrive-files/${file.name}`;
			console.log(`  [${i + 1}/${batch.length}] Uploading: ${file.name}`);
			await uploadToR2(key, data, mimeType);

			const imageUrl = `${R2_PUBLIC_URL}/${key}`;
			const id = crypto.randomUUID();
			const sql = `INSERT INTO gdrive_file (id, name, image_url, created_at) VALUES (${escape(id)}, ${escape(normalizedName)}, ${escape(imageUrl)}, ${timestamp});`;

			const tempFile = path.join(
				os.tmpdir(),
				`sync-dropbox-${timestamp}-${batchNum}-${i}.sql`,
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
				console.log(
					`  [${i + 1}/${batch.length}] Inserted into DB: ${file.name}`,
				);
			} catch (err) {
				console.error(
					`  [${i + 1}/${batch.length}] DB insert failed: ${file.name} - ${err}`,
				);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			console.error(
				`  [${i + 1}/${batch.length}] Failed: ${file.name} - ${message}`,
			);
		}

		await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY));
	}

	console.log(`  Batch ${batchNum}/${totalBatches} complete`);
}

async function main() {
	console.log(`Syncing files from Dropbox to R2 (${env} environment)...`);
	console.log(`Concurrency: ${concurrency}, Batch size: ${batchSize}`);
	console.log("");

	console.log("Listing files from Dropbox shared folder...");
	const allFiles = await listDropboxFiles();
	console.log(`Total files in shared folder: ${allFiles.length}`);
	console.log("");

	const existingNames = await getExistingNames();
	const newFiles = allFiles.filter(
		(f) => !existingNames.has(normalizeName(f.name)),
	);
	console.log(`New files to upload: ${newFiles.length}`);
	console.log(`Already in database: ${allFiles.length - newFiles.length}`);
	console.log("");

	if (newFiles.length === 0) {
		console.log("No new files to upload.");
		return;
	}

	const totalBatches = Math.ceil(newFiles.length / batchSize);
	console.log(
		`Processing ${newFiles.length} files in ${totalBatches} batches of ${batchSize}`,
	);
	console.log("");

	for (let i = 0; i < newFiles.length; i += batchSize) {
		const batch = newFiles.slice(i, i + batchSize);
		const batchNum = Math.floor(i / batchSize) + 1;
		console.log(
			`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} files) ---`,
		);
		await processBatch(batch, batchNum, totalBatches, existingNames);
	}

	console.log("\nDone! All batches complete.");
}

function normalizeName(name: string): string {
	return name
		.replace(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i, "")
		.replace(/[-_]+/g, " ")
		.trim();
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
