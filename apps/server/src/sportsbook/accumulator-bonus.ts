/**
 * Accumulator bonus (DataBet bet boost) — Sportsdey sports table.
 *
 * Bonus % extra on total odds. DataBet multiplier = 1 + percent/100.
 * Every listed sport × fold from Doubles (2-fold) through 50-fold is 20% → 1.20×.
 *
 * Grants POST one DataBet `static` boost per sport × fold so the published
 * percentages apply exactly. Legacy `steps` boosts are deleted on grant so
 * the player is left with only the static table.
 */

export const ACCUMULATOR_SPORTS = ["football", "basketball", "tennis"] as const;
export type AccumulatorSport = (typeof ACCUMULATOR_SPORTS)[number];

export const ACCUMULATOR_MIN_SELECTIONS: Record<AccumulatorSport, number> = {
	football: 2,
	basketball: 2,
	tennis: 2,
};

export const ACCUMULATOR_MAX_SELECTIONS = 50;

/**
 * Legacy `steps` program (no longer POSTed). Kept so we can recognise
 * players who already have that boost and leave them unchanged.
 */
export const ACCUMULATOR_MAX_STEPS = 8;
/** DataBet `steps` increment: +5% odds per extra eligible selection. */
export const ACCUMULATOR_MULTIPLIER_PER_STEP = "0.05";
/** 8 steps × 5% = 40% → 1.40×. */
export const ACCUMULATOR_MAX_MULTIPLIER = (
	1 +
	ACCUMULATOR_MAX_STEPS * Number(ACCUMULATOR_MULTIPLIER_PER_STEP)
).toFixed(2);
export const ACCUMULATOR_PROGRAM_QUANTITY = 9999;

/** Hard cap on extra % (1.20×). Historical SHARED_BONUS_PERCENT may be higher. */
export const ACCUMULATOR_MAX_BONUS_PERCENT = 20;

export function accumulatorProgramMaxSelections(sport: AccumulatorSport): number {
	return ACCUMULATOR_MIN_SELECTIONS[sport] + ACCUMULATOR_MAX_STEPS - 1;
}

/** Shared bonus % from 3-fold through 50-fold (all listed sports). */
const SHARED_BONUS_PERCENT: Record<number, number> = {
	3: 2.5,
	4: 5,
	5: 7.5,
	6: 10,
	7: 12.5,
	8: 15,
	9: 17.5,
	10: 20,
	11: 22.5,
	12: 25,
	13: 30,
	14: 35,
	15: 37.5,
	16: 40,
	17: 45,
	18: 50,
	19: 55,
	20: 60,
	21: 65,
	22: 70,
	23: 75,
	24: 80,
	25: 85,
	26: 90,
	27: 100,
	28: 105,
	29: 110,
	30: 115,
	31: 120,
	32: 125,
	33: 130,
	34: 135,
	35: 140,
	36: 145,
	37: 150,
	38: 157.5,
	39: 165,
	40: 172.5,
	41: 180,
	42: 187.5,
	43: 195,
	44: 202.5,
	45: 210,
	46: 217.5,
	47: 225,
	48: 232.5,
	49: 240,
	50: 250,
};

const DOUBLES_BONUS_PERCENT: Record<AccumulatorSport, number | null> = {
	football: ACCUMULATOR_MAX_BONUS_PERCENT,
	basketball: ACCUMULATOR_MAX_BONUS_PERCENT,
	tennis: ACCUMULATOR_MAX_BONUS_PERCENT,
};

export function getAccumulatorBonusPercent(
	sport: AccumulatorSport,
	selections: number,
): number | null {
	if (
		!Number.isInteger(selections) ||
		selections < 2 ||
		selections > ACCUMULATOR_MAX_SELECTIONS
	) {
		return null;
	}
	if (selections === 2) {
		return DOUBLES_BONUS_PERCENT[sport];
	}
	const percent = SHARED_BONUS_PERCENT[selections];
	if (percent == null) return null;
	return ACCUMULATOR_MAX_BONUS_PERCENT;
}

/** DataBet `multiplier` string, e.g. 7.5% → "1.075", 15% → "1.15". */
export function formatAccumulatorMultiplier(percent: number): string {
	const value = (100 + percent) / 100;
	return Number.isInteger(percent) ? value.toFixed(2) : value.toFixed(3);
}

export function getAccumulatorMultiplier(
	sport: AccumulatorSport,
	selections: number,
): string | null {
	const percent = getAccumulatorBonusPercent(sport, selections);
	if (percent == null) return null;
	return formatAccumulatorMultiplier(percent);
}

export type AccumulatorBonusRow = {
	selections: number;
	label: string;
	football: number | null;
	basketball: number | null;
	tennis: number | null;
};

function foldLabel(selections: number): string {
	if (selections === 2) return "Doubles";
	if (selections === 3) return "Trebles";
	return `${selections}-Fold`;
}

export function getAccumulatorBonusTable(): AccumulatorBonusRow[] {
	const rows: AccumulatorBonusRow[] = [];
	for (let n = 2; n <= ACCUMULATOR_MAX_SELECTIONS; n++) {
		rows.push({
			selections: n,
			label: foldLabel(n),
			football: getAccumulatorBonusPercent("football", n),
			basketball: getAccumulatorBonusPercent("basketball", n),
			tennis: getAccumulatorBonusPercent("tennis", n),
		});
	}
	return rows;
}

function sportConditions(sport: AccumulatorSport, selections: number) {
	return {
		type: "express",
		data: {
			sport: {
				type: "sport",
				match_all_odds: true,
				sport_ids: [sport],
			},
			odds_count: {
				type: "odds_count",
				min: selections,
				max: selections,
			},
		},
	};
}

/**
 * Fields to send to DataBet POST /bet-boosts for one sport × fold.
 * Returns null when that sport has no bonus at that fold.
 */
export function buildAccumulatorBoostPayload(input: {
	sport: AccumulatorSport;
	selections: number;
}): {
	calculation_strategy: {
		type: "static";
		strategy: {
			conditions: unknown[];
			params: { multiplier: string; min_selections: number };
		};
	};
	required_conditions: unknown[];
	applicable_conditions: unknown[];
	bonusPercent: number;
	multiplier: string;
} | null {
	const multiplier = getAccumulatorMultiplier(input.sport, input.selections);
	const bonusPercent = getAccumulatorBonusPercent(
		input.sport,
		input.selections,
	);
	if (multiplier == null || bonusPercent == null) return null;

	const detail = sportConditions(input.sport, input.selections);
	const conditions = [
		{
			type: "bet_details",
			bet_details: [detail],
		},
	];

	return {
		calculation_strategy: {
			type: "static",
			strategy: {
				conditions: [],
				params: {
					multiplier,
					min_selections: input.selections,
				},
			},
		},
		required_conditions: conditions,
		// Must mirror required_conditions (including exact odds_count). Sport-only
		// applicable rules make every fold boost eligible on any acca of that sport,
		// so Databet can latch onto the 50-fold x1.20 boost on a 3-leg ~30x slip.
		applicable_conditions: conditions,
		bonusPercent,
		multiplier,
	};
}

export type AccumulatorFoldBoostPayload = NonNullable<
	ReturnType<typeof buildAccumulatorBoostPayload>
> & {
	sport: AccumulatorSport;
	selections: number;
};

/** One static DataBet boost per published sport × fold (2–50). */
export function listAccumulatorFoldBoostPayloads(): AccumulatorFoldBoostPayload[] {
	const payloads: AccumulatorFoldBoostPayload[] = [];
	for (const sport of ACCUMULATOR_SPORTS) {
		for (
			let selections = 2;
			selections <= ACCUMULATOR_MAX_SELECTIONS;
			selections++
		) {
			const payload = buildAccumulatorBoostPayload({ sport, selections });
			if (!payload) continue;
			payloads.push({ sport, selections, ...payload });
		}
	}
	return payloads;
}

export type AccumulatorStepsBoostPayload = {
	sport: AccumulatorSport;
	minSelections: number;
	maxSelections: number;
	calculation_strategy: {
		type: "steps";
		strategy: {
			conditions: unknown[];
			params: {
				selections_per_step: number;
				multiplier_per_step: string;
				max_multiplier: string;
			};
		};
	};
	required_conditions: unknown[];
	applicable_conditions: unknown[];
};

/** Legacy linear `steps` boost — not granted for new players. */
export function buildAccumulatorStepsBoostPayload(
	sport: AccumulatorSport,
): AccumulatorStepsBoostPayload {
	const minSelections = ACCUMULATOR_MIN_SELECTIONS[sport];
	const maxSelections = accumulatorProgramMaxSelections(sport);
	const sportFilter = {
		type: "sport",
		match_all_odds: true,
		sport_ids: [sport],
	};

	return {
		sport,
		minSelections,
		maxSelections,
		calculation_strategy: {
			type: "steps",
			strategy: {
				conditions: [
					{
						type: "bet_details",
						bet_details: [
							{
								type: "express",
								data: { sport: sportFilter },
							},
						],
					},
				],
				params: {
					selections_per_step: 1,
					multiplier_per_step: ACCUMULATOR_MULTIPLIER_PER_STEP,
					max_multiplier: ACCUMULATOR_MAX_MULTIPLIER,
				},
			},
		},
		required_conditions: [
			{
				type: "bet_details",
				bet_details: [
					{
						type: "express",
						data: {
							sport: sportFilter,
							odds_count: {
								type: "odds_count",
								min: minSelections,
								max: maxSelections,
							},
						},
					},
				],
			},
		],
		applicable_conditions: [
			{
				type: "bet_details",
				bet_details: [
					{
						type: "express",
						data: { sport: sportFilter },
					},
				],
			},
		],
	};
}

export function listAccumulatorStepsBoostPayloads(): AccumulatorStepsBoostPayload[] {
	return ACCUMULATOR_SPORTS.map(buildAccumulatorStepsBoostPayload);
}

export function defaultAccumulatorProgramExpiry(): string {
	const expires = new Date();
	expires.setUTCFullYear(expires.getUTCFullYear() + 1);
	return expires.toISOString();
}

type BetDetailData = {
	sport?: { sport_ids?: string[] };
	odds_count?: { min?: number; max?: number };
};

export type DatabetBoostLike = {
	id?: string;
	calculation_strategy?: {
		type?: string;
		strategy?: { params?: { multiplier?: string } };
	};
	required_conditions?: Array<{
		bet_details?: Array<{
			data?: BetDetailData;
		}>;
	}>;
	applicable_conditions?: Array<{
		bet_details?: Array<{
			data?: BetDetailData;
		}>;
	}>;
};

function requiredBetDetail(boost: DatabetBoostLike): BetDetailData | undefined {
	return boost.required_conditions?.[0]?.bet_details?.[0]?.data;
}

function applicableBetDetail(boost: DatabetBoostLike): BetDetailData | undefined {
	return boost.applicable_conditions?.[0]?.bet_details?.[0]?.data;
}

function accumulatorFoldFromRequired(
	data: BetDetailData,
): { sport: AccumulatorSport; selections: number } | null {
	const sport = ACCUMULATOR_SPORTS.find((candidate) =>
		data.sport?.sport_ids?.includes(candidate),
	);
	if (!sport) return null;
	const min = Number(data.odds_count?.min);
	const max = Number(data.odds_count?.max ?? data.odds_count?.min);
	if (!Number.isInteger(min) || min !== max || min < 2 || min > ACCUMULATOR_MAX_SELECTIONS) {
		return null;
	}
	return { sport, selections: min };
}

/**
 * True when list payload includes applicable_conditions and they are sport-only
 * (or wrong fold). When the list omits applicable_conditions entirely we cannot
 * verify eligibility — caller must not infer "needs repair" from absence alone.
 */
export function boostHasStaleMultiplier(boost: DatabetBoostLike): boolean {
	if (boost.calculation_strategy?.type !== "static") return false;
	const required = requiredBetDetail(boost);
	if (!required) return false;
	const fold = accumulatorFoldFromRequired(required);
	if (!fold) return false;
	const expected = getAccumulatorMultiplier(fold.sport, fold.selections);
	if (expected == null) return false;
	const actual = boost.calculation_strategy.strategy?.params?.multiplier;
	if (actual == null || actual === "") return true;
	return Number.parseFloat(actual) !== Number.parseFloat(expected);
}

export function boostNeedsFoldRepair(boost: DatabetBoostLike): boolean {
	return boostHasLooseApplicableConditions(boost) || boostHasStaleMultiplier(boost);
}

export function boostHasLooseApplicableConditions(boost: DatabetBoostLike): boolean {
	if (boost.calculation_strategy?.type !== "static") return false;
	const required = requiredBetDetail(boost);
	if (!required) return false;
	const fold = accumulatorFoldFromRequired(required);
	if (!fold) return false;
	if (boost.applicable_conditions === undefined) return false;
	if (
		!Array.isArray(boost.applicable_conditions) ||
		boost.applicable_conditions.length === 0
	) {
		return false;
	}
	const applicable = applicableBetDetail(boost);
	if (!applicable?.odds_count) return true;
	const appMin = Number(applicable.odds_count.min);
	const appMax = Number(applicable.odds_count.max ?? applicable.odds_count.min);
	return appMin !== fold.selections || appMax !== fold.selections;
}

/** Whether DataBet included applicable_conditions on list items (shape probe). */
export function betBoostListIncludesApplicable(
	boosts: DatabetBoostLike[],
): boolean {
	return boosts.some((boost) => boost.applicable_conditions !== undefined);
}

export type AccumulatorFoldBoostRepair = {
	boostId: string;
	sport: AccumulatorSport;
	selections: number;
	applicable_conditions: unknown[];
	calculation_strategy: NonNullable<
		ReturnType<typeof buildAccumulatorBoostPayload>
	>["calculation_strategy"];
};

/** PATCH targets for loose applicable rules or outdated multipliers. */
export function planAccumulatorFoldRepairs(
	existing: DatabetBoostLike[],
	options: { skipBoostIds?: ReadonlySet<string> } = {},
): AccumulatorFoldBoostRepair[] {
	const repairs: AccumulatorFoldBoostRepair[] = [];
	for (const boost of existing) {
		if (!boost.id || options.skipBoostIds?.has(boost.id)) continue;
		if (!boostNeedsFoldRepair(boost)) continue;
		const required = requiredBetDetail(boost);
		if (!required) continue;
		const fold = accumulatorFoldFromRequired(required);
		if (!fold) continue;
		const payload = buildAccumulatorBoostPayload(fold);
		if (!payload) continue;
		repairs.push({
			boostId: boost.id,
			sport: fold.sport,
			selections: fold.selections,
			applicable_conditions: payload.applicable_conditions,
			calculation_strategy: payload.calculation_strategy,
		});
	}
	return repairs;
}

/** True when the player already has the legacy linear `steps` program for this sport. */
export function boostCoversAccumulatorSport(
	boost: DatabetBoostLike,
	sport: AccumulatorSport,
): boolean {
	if (boost.calculation_strategy?.type !== "steps") return false;
	const sportIds = requiredBetDetail(boost)?.sport?.sport_ids;
	return Array.isArray(sportIds) && sportIds.includes(sport);
}

/** True when the player already has a static boost for this exact sport × fold. */
export function boostCoversAccumulatorFold(
	boost: DatabetBoostLike,
	sport: AccumulatorSport,
	selections: number,
): boolean {
	if (boost.calculation_strategy?.type !== "static") return false;
	const data = requiredBetDetail(boost);
	const sportIds = data?.sport?.sport_ids;
	if (!Array.isArray(sportIds) || !sportIds.includes(sport)) return false;
	const min = Number(data?.odds_count?.min);
	const max = Number(data?.odds_count?.max ?? data?.odds_count?.min);
	return min === selections && max === selections;
}

export function planAccumulatorFoldGrants(existing: DatabetBoostLike[]): {
	toCreate: AccumulatorFoldBoostPayload[];
	blockedLegacySports: AccumulatorSport[];
	legacyStepsBoostIds: string[];
} {
	const legacyStepsBoostIds = existing
		.filter((boost) =>
			ACCUMULATOR_SPORTS.some((sport) =>
				boostCoversAccumulatorSport(boost, sport),
			),
		)
		.map((boost) => boost.id)
		.filter((id): id is string => typeof id === "string" && id.length > 0);

	const blockedLegacySports = ACCUMULATOR_SPORTS.filter((sport) =>
		existing.some((boost) => boostCoversAccumulatorSport(boost, sport)),
	);

	const toCreate = listAccumulatorFoldBoostPayloads().filter((preset) => {
		if (blockedLegacySports.includes(preset.sport)) return false;
		return !existing.some((boost) =>
			boostCoversAccumulatorFold(boost, preset.sport, preset.selections),
		);
	});
	return { toCreate, blockedLegacySports, legacyStepsBoostIds };
}
