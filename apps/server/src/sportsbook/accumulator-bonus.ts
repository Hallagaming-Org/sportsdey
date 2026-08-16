/**
 * Accumulator bonus (DataBet bet boost) — Sportsdey sports table.
 *
 * Bonus % extra on total odds. DataBet multiplier = 1 + percent/100.
 * Example: 5% → 1.05, 100% → 2.00, 500% → 6.00.
 *
 * Football has no Doubles (2-fold) bonus. Basketball and tennis start at 3%.
 * From Trebles (3-fold) onward all three sports share the same scale, up to 50-fold.
 */

export const ACCUMULATOR_SPORTS = ["football", "basketball", "tennis"] as const;
export type AccumulatorSport = (typeof ACCUMULATOR_SPORTS)[number];

export const ACCUMULATOR_MIN_SELECTIONS: Record<AccumulatorSport, number> = {
	football: 3,
	basketball: 2,
	tennis: 2,
};

export const ACCUMULATOR_MAX_SELECTIONS = 50;

/**
 * DataBet rejects steps scales longer than 8:
 * (max_multiplier - 1) / multiplier_per_step must be <= 8.
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

export function accumulatorProgramMaxSelections(sport: AccumulatorSport): number {
	return ACCUMULATOR_MIN_SELECTIONS[sport] + ACCUMULATOR_MAX_STEPS - 1;
}

/** Shared bonus % from 3-fold through 50-fold (all listed sports). */
const SHARED_BONUS_PERCENT: Record<number, number> = {
	3: 5,
	4: 10,
	5: 15,
	6: 20,
	7: 25,
	8: 30,
	9: 35,
	10: 40,
	11: 45,
	12: 50,
	13: 60,
	14: 70,
	15: 75,
	16: 80,
	17: 90,
	18: 100,
	19: 110,
	20: 120,
	21: 130,
	22: 140,
	23: 150,
	24: 160,
	25: 170,
	26: 180,
	27: 200,
	28: 210,
	29: 220,
	30: 230,
	31: 240,
	32: 250,
	33: 260,
	34: 270,
	35: 280,
	36: 290,
	37: 300,
	38: 315,
	39: 330,
	40: 345,
	41: 360,
	42: 375,
	43: 390,
	44: 405,
	45: 420,
	46: 435,
	47: 450,
	48: 465,
	49: 480,
	50: 500,
};

const DOUBLES_BONUS_PERCENT: Record<AccumulatorSport, number | null> = {
	football: null,
	basketball: 3,
	tennis: 3,
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
	return SHARED_BONUS_PERCENT[selections] ?? null;
}

/** DataBet `multiplier` string, e.g. 15% → "1.15". */
export function getAccumulatorMultiplier(
	sport: AccumulatorSport,
	selections: number,
): string | null {
	const percent = getAccumulatorBonusPercent(sport, selections);
	if (percent == null) return null;
	return ((100 + percent) / 100).toFixed(2);
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
 * Returns null when that sport has no bonus at that fold (football doubles).
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
		applicable_conditions: [
			{
				type: "bet_details",
				bet_details: [
					{
						type: "express",
						data: {
							sport: {
								type: "sport",
								match_all_odds: true,
								sport_ids: [input.sport],
							},
						},
					},
				],
			},
		],
		bonusPercent,
		multiplier,
	};
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

/**
 * One DataBet `steps` boost per sport.
 * Shown as soon as the slip hits the sport's min fold; multiplier grows as
 * the player adds more eligible games (accumulator boost structure).
 */
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

type DatabetBoostLike = {
	calculation_strategy?: { type?: string };
	required_conditions?: Array<{
		bet_details?: Array<{
			data?: { sport?: { sport_ids?: string[] } };
		}>;
	}>;
};

export function boostCoversAccumulatorSport(
	boost: DatabetBoostLike,
	sport: AccumulatorSport,
): boolean {
	if (boost.calculation_strategy?.type !== "steps") return false;
	const sportIds =
		boost.required_conditions?.[0]?.bet_details?.[0]?.data?.sport?.sport_ids;
	return Array.isArray(sportIds) && sportIds.includes(sport);
}
