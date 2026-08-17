const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const MIN_AGE_YEARS = 18;

export type ParsedDob =
	| { ok: true; value: undefined }
	| { ok: true; value: null }
	| { ok: true; value: string }
	| { ok: false; error: string };

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIsoDate(year: number, month: number, day: number): string | null {
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
		return null;
	}
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ageOn(isoDate: string, today = new Date()): number {
	const match = ISO_DATE.exec(isoDate);
	if (!match) return -1;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	let age = today.getUTCFullYear() - year;
	const monthDelta = today.getUTCMonth() + 1 - month;
	if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day)) {
		age -= 1;
	}
	return age;
}

export function parseDobInput(value: unknown): ParsedDob {
	if (value === undefined) {
		return { ok: true, value: undefined };
	}
	if (value === null || value === "") {
		return { ok: true, value: null };
	}
	if (typeof value !== "string") {
		return { ok: false, error: "Invalid date of birth" };
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return { ok: true, value: null };
	}

	let iso: string | null = null;
	const isoMatch = ISO_DATE.exec(trimmed);
	if (isoMatch) {
		iso = toIsoDate(
			Number(isoMatch[1]),
			Number(isoMatch[2]),
			Number(isoMatch[3]),
		);
	} else {
		const dmyMatch = DMY_DATE.exec(trimmed);
		if (dmyMatch) {
			iso = toIsoDate(
				Number(dmyMatch[3]),
				Number(dmyMatch[2]),
				Number(dmyMatch[1]),
			);
		}
	}

	if (!iso) {
		return {
			ok: false,
			error: "Invalid date of birth. Use YYYY-MM-DD or DD/MM/YYYY",
		};
	}

	if (iso > new Date().toISOString().slice(0, 10)) {
		return { ok: false, error: "Date of birth cannot be in the future" };
	}

	if (ageOn(iso) < MIN_AGE_YEARS) {
		return { ok: false, error: "You must be at least 18 years old" };
	}

	return { ok: true, value: iso };
}
