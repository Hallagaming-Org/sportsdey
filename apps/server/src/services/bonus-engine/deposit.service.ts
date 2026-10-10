import type { ExecutionContext } from "hono";
import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_DEFAULT_CURRENCY } from "./bonus-engine.service.constant";
import { isBonusEngineConfigured } from "./config";
import {
	reportBonusEngineDeposit,
	runBonusEngineBackground,
} from "./events.service";

/**
 * Reports a settled deposit to Bonus Engine (deposit bonuses, mission and
 * tournament deposit triggers) for every payment provider. Call once, only
 * on the request that actually credited the wallet. Never throws and never
 * delays the provider's response: it runs under `waitUntil` when available,
 * and a failed report is parked in the outbox.
 */
export async function reportBonusEngineDepositInBackground(payload: {
	env: CloudflareBindings;
	executionCtx: ExecutionContext | undefined;
	userId: string;
	amountKobo: number;
	transactionId: string;
	paymentMethod: string;
}): Promise<void> {
	if (!isBonusEngineConfigured(payload.env)) {
		console.warn("Bonus Engine deposit report skipped", {
			transactionId: payload.transactionId,
			userId: payload.userId,
			paymentMethod: payload.paymentMethod,
			reason: "not_configured",
		});
		return;
	}
	if (!(payload.amountKobo > 0) || !payload.transactionId) {
		console.warn("Bonus Engine deposit report skipped", {
			transactionId: payload.transactionId,
			userId: payload.userId,
			paymentMethod: payload.paymentMethod,
			reason: "invalid_amount",
		});
		return;
	}

	const work = reportBonusEngineDeposit({
		env: payload.env,
		deposit: {
			userId: payload.userId,
			amount: payload.amountKobo / 100,
			transactionId: payload.transactionId,
			currency: BONUS_ENGINE_DEFAULT_CURRENCY,
			paymentProvider: payload.paymentMethod,
		},
	})
		.then((result) => {
			if (result.ok) {
				console.info("Bonus Engine deposit report accepted", {
					transactionId: payload.transactionId,
					userId: payload.userId,
					paymentMethod: payload.paymentMethod,
					status: result.status,
				});
				return;
			}
			console.error("Bonus Engine deposit report failed", {
				transactionId: payload.transactionId,
				userId: payload.userId,
				paymentMethod: payload.paymentMethod,
				status: result.status,
				error: result.error,
			});
		})
		.catch((error: unknown) => {
			console.error("Bonus Engine deposit report error", {
				transactionId: payload.transactionId,
				userId: payload.userId,
				paymentMethod: payload.paymentMethod,
				error,
			});
		});

	await runBonusEngineBackground(payload.executionCtx, work);
}
