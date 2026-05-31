export const SPORTS = {
	FOOTBALL: "football",
	TENNIS: "tennis",
	BASKETBALL: "basketball",
	BOXING: "boxing",
	UFC: "ufc",
} as const;

export type Sport = (typeof SPORTS)[keyof typeof SPORTS];
