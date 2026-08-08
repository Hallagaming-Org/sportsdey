import {
	createPublicClient,
	formatEther,
	formatUnits,
	http,
	parseAbiItem,
	type Address,
	type Hash,
	type PublicClient,
} from "viem";
import { polygonAmoy } from "viem/chains";
import {
	OPENFORT_CHAIN_LABEL,
	OPENFORT_EVM_CHAIN_ID,
	POLYGON_AMOY_USDC,
	USDC_DECIMALS,
} from "@/lib/openfort/config";
import type { WalletTransaction } from "@/lib/wallet-transactions";

export type CryptoAssetSymbol = "POL" | "USDC";

export type CryptoIncomingTransfer = {
	id: string;
	txHash: Hash;
	asset: CryptoAssetSymbol;
	amount: number;
	amountLabel: string;
	from: Address;
	createdAt: string;
	blockNumber: bigint;
};

const TRANSFER_EVENT = parseAbiItem(
	"event Transfer(address indexed from, address indexed to, uint256 value)",
);

/** Prefer a dedicated Amoy RPC that allows getLogs; override via env if needed. */
const AMOY_HISTORY_RPC =
	(import.meta.env.VITE_POLYGON_AMOY_RPC as string | undefined) ||
	"https://polygon-amoy.gateway.tenderly.co";

const USDC_LOOKBACK_BLOCKS = 80_000n; // ~2 days on Amoy
const USDC_CHUNK = 5_000n;
/** Native POL has no Transfer logs — only scan a short window; older POL stays in cache. */
const POL_LOOKBACK_BLOCKS = 400n;
const POL_CONCURRENCY = 20;
const CACHE_PREFIX = "sportsdey:crypto-incoming:";

let historyClient: PublicClient | null = null;

function getHistoryClient(): PublicClient {
	if (!historyClient) {
		historyClient = createPublicClient({
			chain: polygonAmoy,
			transport: http(AMOY_HISTORY_RPC, { timeout: 30_000 }),
		});
	}
	return historyClient;
}

function cacheKey(address: Address) {
	return `${CACHE_PREFIX}${OPENFORT_EVM_CHAIN_ID}:${address.toLowerCase()}`;
}

function readCache(address: Address): CryptoIncomingTransfer[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(cacheKey(address));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as Array<
			Omit<CryptoIncomingTransfer, "blockNumber"> & { blockNumber: string }
		>;
		return parsed.map((t) => ({
			...t,
			blockNumber: BigInt(t.blockNumber),
		}));
	} catch {
		return [];
	}
}

function writeCache(address: Address, transfers: CryptoIncomingTransfer[]) {
	if (typeof window === "undefined") return;
	try {
		const serializable = transfers.slice(0, 50).map((t) => ({
			...t,
			blockNumber: t.blockNumber.toString(),
		}));
		window.localStorage.setItem(cacheKey(address), JSON.stringify(serializable));
	} catch {
		/* ignore quota */
	}
}

function mergeTransfers(
	...lists: CryptoIncomingTransfer[][]
): CryptoIncomingTransfer[] {
	const byId = new Map<string, CryptoIncomingTransfer>();
	for (const list of lists) {
		for (const t of list) byId.set(t.id, t);
	}
	return [...byId.values()].sort((a, b) =>
		a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
	);
}

async function blockTimestamp(
	client: PublicClient,
	blockNumber: bigint,
	cache: Map<string, string>,
): Promise<string> {
	const key = blockNumber.toString();
	const hit = cache.get(key);
	if (hit) return hit;
	const block = await client.getBlock({ blockNumber });
	const iso = new Date(Number(block.timestamp) * 1000).toISOString();
	cache.set(key, iso);
	return iso;
}

async function fetchIncomingUsdc(
	client: PublicClient,
	address: Address,
): Promise<CryptoIncomingTransfer[]> {
	const latest = await client.getBlockNumber();
	const start = latest > USDC_LOOKBACK_BLOCKS ? latest - USDC_LOOKBACK_BLOCKS : 0n;
	const tsCache = new Map<string, string>();
	const out: CryptoIncomingTransfer[] = [];

	for (let from = start; from <= latest; from += USDC_CHUNK + 1n) {
		const toBlock = from + USDC_CHUNK > latest ? latest : from + USDC_CHUNK;
		const logs = await client.getLogs({
			address: POLYGON_AMOY_USDC,
			event: TRANSFER_EVENT,
			args: { to: address },
			fromBlock: from,
			toBlock,
		});

		for (const log of logs) {
			if (log.args.value === undefined || !log.args.from || !log.transactionHash) {
				continue;
			}
			const human = Number(formatUnits(log.args.value, USDC_DECIMALS));
			if (!Number.isFinite(human) || human <= 0) continue;
			const createdAt = await blockTimestamp(client, log.blockNumber, tsCache);
			out.push({
				id: `${log.transactionHash}-${log.logIndex}`,
				txHash: log.transactionHash,
				asset: "USDC",
				amount: human,
				amountLabel: `${human.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`,
				from: log.args.from,
				createdAt,
				blockNumber: log.blockNumber,
			});
		}
	}

	return out;
}

async function fetchIncomingPol(
	client: PublicClient,
	address: Address,
): Promise<CryptoIncomingTransfer[]> {
	const latest = await client.getBlockNumber();
	const start = latest > POL_LOOKBACK_BLOCKS ? latest - POL_LOOKBACK_BLOCKS : 0n;
	const target = address.toLowerCase();
	const out: CryptoIncomingTransfer[] = [];

	const blockNumbers: bigint[] = [];
	for (let n = start; n <= latest; n++) blockNumbers.push(n);

	for (let i = 0; i < blockNumbers.length; i += POL_CONCURRENCY) {
		const slice = blockNumbers.slice(i, i + POL_CONCURRENCY);
		const blocks = await Promise.all(
			slice.map((blockNumber) =>
				client.getBlock({ blockNumber, includeTransactions: true }),
			),
		);

		for (const block of blocks) {
			const createdAt = new Date(Number(block.timestamp) * 1000).toISOString();

			for (const tx of block.transactions) {
				if (typeof tx === "string") continue;
				if (!tx.to || tx.to.toLowerCase() !== target) continue;
				if (tx.value <= 0n) continue;

				const human = Number(formatEther(tx.value));
				if (!Number.isFinite(human) || human <= 0) continue;

				out.push({
					id: `${tx.hash}-native`,
					txHash: tx.hash,
					asset: "POL",
					amount: human,
					amountLabel: `${human.toLocaleString(undefined, { maximumFractionDigits: 6 })} POL`,
					from: tx.from,
					createdAt,
					blockNumber: block.number,
				});
			}
		}
	}

	return out;
}

export async function fetchIncomingCryptoTransfers(
	address: Address,
): Promise<CryptoIncomingTransfer[]> {
	const client = getHistoryClient();
	const cached = readCache(address);

	try {
		const [usdc, pol] = await Promise.all([
			fetchIncomingUsdc(client, address).catch((err) => {
				console.warn("[crypto-incoming] USDC history fetch failed", err);
				return [] as CryptoIncomingTransfer[];
			}),
			fetchIncomingPol(client, address).catch((err) => {
				console.warn("[crypto-incoming] POL history fetch failed", err);
				return [] as CryptoIncomingTransfer[];
			}),
		]);

		// If both chain fetches failed, keep serving cached rows instead of wiping the list.
		if (usdc.length === 0 && pol.length === 0 && cached.length > 0) {
			return cached;
		}

		const merged = mergeTransfers(cached, usdc, pol);
		writeCache(address, merged);
		return merged;
	} catch (err) {
		console.warn("[crypto-incoming] history fetch failed; using cache", err);
		return cached;
	}
}

export function cryptoTransferToWalletTx(
	transfer: CryptoIncomingTransfer,
	userId = "crypto",
): WalletTransaction {
	return {
		id: `crypto_${transfer.id}`,
		userId,
		amount: transfer.amount,
		type: "credit",
		reference: transfer.txHash,
		status: "success",
		paymentMethod: "crypto",
		metadata: {
			asset: transfer.asset,
			network: OPENFORT_CHAIN_LABEL,
			from: transfer.from,
			txHash: transfer.txHash,
			amountLabel: transfer.amountLabel,
			explorerUrl: `https://amoy.polygonscan.com/tx/${transfer.txHash}`,
		},
		createdAt: transfer.createdAt,
	};
}
