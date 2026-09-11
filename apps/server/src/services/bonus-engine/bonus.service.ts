import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BODY_FIELD,
	BONUS_ENGINE_BONUS_STATUS,
	BONUS_ENGINE_PATH,
	BONUS_ENGINE_USER_ACTION,
} from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineBonusCampaignItem,
	BonusEngineBonusWalletData,
	BonusEngineListCampaignsBody,
	BonusEngineLoyaltyScopedBody,
	BonusEngineUserBonusActionBody,
	BonusEngineUserBonusItem,
} from "./bonus-engine.service.type";
import {
	bonusEngineRequest,
	extractBonusEngineMessage,
	isBonusEngineJsonNotFound,
	isBonusEngineUnhandledException,
} from "./client";
import { getBonusEngineConfig } from "./config";
import { attachLiveSportsbookPaths } from "./mission-sportsbook-path";
import { getBonusEngineWalletBalances, listBonusEngineUserBonusSnapshots } from "./persistence.service";
import { syncBonusEnginePlayerOnAppLogin } from "./player.service";
import { creditBonusActivation } from "./rewards.service";
import { getBonusEngineAccessToken } from "./token.service";

type LocalUserBonusSnapshot = {
	bonusId: string;
	status: string;
	payloadJson: string;
};

const KOBO_PER_MAJOR = 100;

type BonusEngineEnvelope<T> = {
	status?: number;
	message?: string;
	data?: T;
};

/**
 * Builds the signed Bonus Engine body for player-scoped bonus reads
 * (`list_active_campaign`, `getall_User_bonus`).
 */
export function buildBonusEnginePlayerScopedBody(payload: {
	clientId: string;
	projectId: string;
	userId: string;
}): BonusEngineLoyaltyScopedBody {
	return {
		[BONUS_ENGINE_BODY_FIELD.CLIENT_ID]: payload.clientId,
		[BONUS_ENGINE_BODY_FIELD.PROJECT_ID]: payload.projectId,
		[BONUS_ENGINE_BODY_FIELD.USER_ID]: payload.userId,
	};
}

/**
 * Builds `POST /list_active_campaign` body. `bonus_type` is always sent.
 */
export function buildBonusEngineListCampaignsBody(payload: {
	clientId: string;
	projectId: string;
	userId: string;
	bonusType: string;
}): BonusEngineListCampaignsBody {
	return {
		...buildBonusEnginePlayerScopedBody(payload),
		[BONUS_ENGINE_BODY_FIELD.BONUS_TYPE]: payload.bonusType,
	};
}

/**
 * Builds `POST /activate_bonus` and `POST /cancel_bonus` body.
 */
export function buildBonusEngineUserBonusActionBody(payload: {
	clientId: string;
	projectId: string;
	userId: string;
	userbonusId: string;
}): BonusEngineUserBonusActionBody {
	return {
		...buildBonusEnginePlayerScopedBody(payload),
		[BONUS_ENGINE_BODY_FIELD.USERBONUS_ID]: payload.userbonusId,
	};
}

/**
 * Finds a player assignment in `getall_User_bonus` by `_id` / `userbonus_id`.
 */
export function findUserBonusById(payload: {
	bonuses: BonusEngineUserBonusItem[];
	userbonusId: string;
}): BonusEngineUserBonusItem | null {
	const wanted = payload.userbonusId.trim();
	if (!wanted) return null;
	for (const row of payload.bonuses) {
		const id = asTrimmedString(row._id ?? row.userbonus_id ?? row.id);
		if (id === wanted) return row;
	}
	return null;
}

/**
 * Reads activation credit amounts from a player assignment. Engine figures are
 * major units (naira), not kobo. Missing/invalid values become 0.
 */
export function parseBonusActivationAmounts(
	record: BonusEngineUserBonusItem | null,
): { bonusAmountMajor: number; cashAmountMajor: number } {
	if (!record) {
		return { bonusAmountMajor: 0, cashAmountMajor: 0 };
	}
	return {
		bonusAmountMajor: asPositiveAmount(record.bonus_amount),
		cashAmountMajor: asPositiveAmount(record.cash_amount),
	};
}

/**
 * Maps `updateBonus` amount_change fields to signed kobo. Real change is
 * applied as sent. Positive bonus change is funds leaving the bonus wallet
 * (debit); negative bonus change credits it back.
 */
export function resolveBonusStatusWalletDeltas(payload: {
	realAmountChange: number;
	bonusAmountChange: number;
}): { realKobo: number; bonusKobo: number } {
	return {
		realKobo: toSignedKobo(payload.realAmountChange),
		bonusKobo: -toSignedKobo(payload.bonusAmountChange),
	};
}

/**
 * True when allocation payload says the bonus is already live, so SportsDey
 * should credit using the same activate idempotency keys.
 */
export function shouldCreditAllocatedBonus(
	record: BonusEngineUserBonusItem,
): boolean {
	const userAction = asTrimmedString(record.user_action).toUpperCase();
	const status = asTrimmedString(record.status).toUpperCase();
	return (
		userAction === BONUS_ENGINE_USER_ACTION.ACTIVATED ||
		status === BONUS_ENGINE_BONUS_STATUS.ACTIVE
	);
}

/**
 * Reads `bonus_data` as one object or an array of assignment records.
 */
export function parseBonusAllocationRecords(
	body: Record<string, unknown>,
): BonusEngineUserBonusItem[] {
	const raw = body[BONUS_ENGINE_BODY_FIELD.BONUS_DATA] ?? body.bonuses;
	const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
	return rows.filter(
		(row): row is BonusEngineUserBonusItem =>
			typeof row === "object" && row !== null && !Array.isArray(row),
	);
}

/**
 * Overlays local allocation/status snapshots onto `getall_User_bonus` rows
 * so the player list includes engine-assigned bonuses that the list API
 * has not caught up with, and local status wins when both exist.
 */
export function mergeUserBonusesWithLocalSnapshots(payload: {
	bonuses: BonusEngineUserBonusItem[];
	snapshots: LocalUserBonusSnapshot[];
}): BonusEngineUserBonusItem[] {
	if (payload.snapshots.length === 0) return payload.bonuses;
	const byId = new Map<string, BonusEngineUserBonusItem>();
	for (const bonus of payload.bonuses) {
		const id = asTrimmedString(bonus._id ?? bonus.userbonus_id ?? bonus.id);
		if (id) byId.set(id, bonus);
	}
	for (const snapshot of payload.snapshots) {
		const parsed = parseSnapshotPayload(snapshot.payloadJson);
		const existing = byId.get(snapshot.bonusId);
		if (existing) {
			byId.set(snapshot.bonusId, {
				...existing,
				...parsed,
				_id: snapshot.bonusId,
				...(snapshot.status ? { status: snapshot.status } : {}),
			});
			continue;
		}
		byId.set(snapshot.bonusId, {
			...parsed,
			_id: snapshot.bonusId,
			...(snapshot.status ? { status: snapshot.status } : {}),
		});
	}
	return [...byId.values()];
}

/**
 * Treats a successful activate, or an "already activated" engine error, as
 * accepted so wallet credit can still run idempotently on retry.
 */
export function isBonusEngineActivateAccepted(
	result: BonusEngineApiResult<unknown>,
): boolean {
	if (result.ok) return true;
	const haystack = `${result.error ?? ""} ${result.message ?? ""}`.toLowerCase();
	return /already.?activat/.test(haystack);
}

/**
 * Lists active bonus campaigns for the signed-in player (`POST /list_active_campaign`)
 * and overlays a Data.Bet `sportsbook_path` when `sports_league_events` is set.
 */
export async function listBonusEngineCampaigns(payload: {
	env: CloudflareBindings;
	userId: string;
	bonusType: string;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineBonusCampaignItem[]>>> {
	const result = await signedBonusRequest<
		BonusEngineEnvelope<BonusEngineBonusCampaignItem[]>
	>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LIST_ACTIVE_CAMPAIGN,
		userId: payload.userId,
		bonusType: payload.bonusType,
	});
	if (!result.ok) return result;

	const campaigns = asRecordArray(result.data?.data);
	const withSportsbookPaths = await attachLiveSportsbookPaths({
		env: payload.env,
		records: campaigns,
	});
	return {
		...result,
		data: {
			...result.data,
			data: withSportsbookPaths,
		},
	};
}

/**
 * Lists player bonus assignments (`POST /getall_User_bonus`) and overlays
 * local allocation/status snapshots. Engine 404 or a caught TypeError
 * (missing player, `user._id` on null) becomes an empty list so
 * callback-assigned bonuses still show. Retries once after `POST /login`
 * when the engine crashed that way.
 */
export async function listBonusEngineUserBonuses(payload: {
	env: CloudflareBindings;
	userId: string;
	username?: string;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineUserBonusItem[]>>> {
	let result = await signedBonusRequest<
		BonusEngineEnvelope<BonusEngineUserBonusItem[]>
	>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.GETALL_USER_BONUS,
		userId: payload.userId,
	});

	if (isBonusEngineUnhandledException(bonusEngineResultText(result))) {
		const username = payload.username?.trim() || payload.userId;
		console.error("Bonus Engine getall_User_bonus crashed; retrying after player sync", {
			userId: payload.userId,
			status: result.status,
			error: bonusEngineResultText(result),
		});
		await syncBonusEnginePlayerOnAppLogin({
			env: payload.env,
			userId: payload.userId,
			username,
		});
		result = await signedBonusRequest<
			BonusEngineEnvelope<BonusEngineUserBonusItem[]>
		>({
			env: payload.env,
			path: BONUS_ENGINE_PATH.GETALL_USER_BONUS,
			userId: payload.userId,
		});
	}

	const snapshots = await listBonusEngineUserBonusSnapshots({
		env: payload.env,
		userId: payload.userId,
	});

	if (
		!result.ok &&
		!isBonusEngineJsonNotFound(result) &&
		!isBonusEngineUnhandledException(bonusEngineResultText(result))
	) {
		return result;
	}

	const engineCrashed = isBonusEngineUnhandledException(
		bonusEngineResultText(result),
	);
	const bonuses =
		result.ok && !engineCrashed ? asRecordArray(result.data?.data) : [];
	const merged = mergeUserBonusesWithLocalSnapshots({ bonuses, snapshots });
	const withSportsbookPaths = await attachLiveSportsbookPaths({
		env: payload.env,
		records: merged,
	});
	const message =
		engineCrashed || isBonusEngineJsonNotFound(result)
			? withSportsbookPaths.length > 0
				? "OK"
				: "No player bonuses found"
			: result.message;
	return {
		ok: true,
		status: 200,
		data: {
			...result.data,
			data: withSportsbookPaths,
			message,
		},
		message,
	};
}

/**
 * Activates a player bonus on Bonus Engine, then credits SportsDey wallets from
 * the assignment amounts. Engine wallet figures in the response are replaced
 * with SportsDey balances after credit.
 */
export async function activateBonusEngineUserBonus(payload: {
	env: CloudflareBindings;
	userId: string;
	userbonusId: string;
	username?: string;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineBonusWalletData>>> {
	const listResult = await listBonusEngineUserBonuses({
		env: payload.env,
		userId: payload.userId,
		username: payload.username,
	});
	const bonuses = listResult.ok
		? asRecordArray(listResult.data?.data)
		: [];
	const assignment = findUserBonusById({
		bonuses,
		userbonusId: payload.userbonusId,
	});
	const amounts = parseBonusActivationAmounts(assignment);
	if (!assignment) {
		console.warn("Bonus assignment not in player list; activate credit may skip", {
			userId: payload.userId,
			userbonusId: payload.userbonusId,
		});
	}

	const activateResult = await signedBonusActionRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.ACTIVATE_BONUS,
		userId: payload.userId,
		userbonusId: payload.userbonusId,
	});
	if (!isBonusEngineActivateAccepted(activateResult)) {
		return activateResult;
	}

	const credit = await creditBonusActivation({
		env: payload.env,
		userId: payload.userId,
		userbonusId: payload.userbonusId,
		bonusAmountMajor: amounts.bonusAmountMajor,
		cashAmountMajor: amounts.cashAmountMajor,
	});
	if (credit.status === "wallet_missing") {
		return {
			ok: false,
			status: 502,
			error: "Failed to credit bonus wallets",
		};
	}

	return overlaySportsDeyWalletBalances({
		env: payload.env,
		userId: payload.userId,
		result: activateResult,
	});
}

/**
 * Cancels a player bonus on Bonus Engine. Remaining bonus wallet is not
 * debited here — SportsDey has one shared game wallet, not per-assignment.
 */
export async function cancelBonusEngineUserBonus(payload: {
	env: CloudflareBindings;
	userId: string;
	userbonusId: string;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineBonusWalletData>>> {
	const cancelResult = await signedBonusActionRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.CANCEL_BONUS,
		userId: payload.userId,
		userbonusId: payload.userbonusId,
	});
	if (!cancelResult.ok) return cancelResult;

	return overlaySportsDeyWalletBalances({
		env: payload.env,
		userId: payload.userId,
		result: cancelResult,
	});
}

async function overlaySportsDeyWalletBalances(payload: {
	env: CloudflareBindings;
	userId: string;
	result: BonusEngineApiResult<BonusEngineEnvelope<BonusEngineBonusWalletData>>;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineBonusWalletData>>> {
	const balances = await getBonusEngineWalletBalances({
		env: payload.env,
		userId: payload.userId,
	});
	const envelope = payload.result.data;
	const nested =
		typeof envelope?.data === "object" && envelope.data !== null
			? envelope.data
			: {};
	return {
		...payload.result,
		ok: true,
		data: {
			...envelope,
			data: {
				...nested,
				user_id: payload.userId,
				real_wallet_balance: balances.realWalletBalance,
				bonus_wallet_balance: balances.bonusWalletBalance,
			},
		},
	};
}

async function signedBonusRequest<T>(payload: {
	env: CloudflareBindings;
	path: string;
	userId: string;
	bonusType?: string;
}): Promise<BonusEngineApiResult<T>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	const body = payload.bonusType
		? buildBonusEngineListCampaignsBody({
				clientId: config.clientId,
				projectId: config.projectId,
				userId: payload.userId,
				bonusType: payload.bonusType,
			})
		: buildBonusEnginePlayerScopedBody({
				clientId: config.clientId,
				projectId: config.projectId,
				userId: payload.userId,
			});

	return bonusEngineRequest<T>({
		env: payload.env,
		path: payload.path,
		accessToken: tokenResult.data,
		body,
	});
}

async function signedBonusActionRequest(
	payload: {
		env: CloudflareBindings;
		path: string;
		userId: string;
		userbonusId: string;
	},
): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineBonusWalletData>>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	return bonusEngineRequest({
		env: payload.env,
		path: payload.path,
		accessToken: tokenResult.data,
		body: buildBonusEngineUserBonusActionBody({
			clientId: config.clientId,
			projectId: config.projectId,
			userId: payload.userId,
			userbonusId: payload.userbonusId,
		}),
	});
}

function bonusEngineResultText(
	result: BonusEngineApiResult<{ message?: string }>,
): string {
	if (result.error?.trim()) return result.error;
	if (result.message?.trim()) return result.message;
	return extractBonusEngineMessage(result.data, "");
}

function asRecordArray(value: unknown): BonusEngineUserBonusItem[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(row): row is BonusEngineUserBonusItem =>
			typeof row === "object" && row !== null && !Array.isArray(row),
	);
}

function parseSnapshotPayload(value: string): BonusEngineUserBonusItem {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as BonusEngineUserBonusItem;
		}
	} catch {
		return {};
	}
	return {};
}

function asTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asPositiveAmount(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	return 0;
}

function toSignedKobo(amountMajor: number): number {
	if (!Number.isFinite(amountMajor) || amountMajor === 0) return 0;
	return Math.round(amountMajor * KOBO_PER_MAJOR);
}
