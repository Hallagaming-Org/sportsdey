import { eq, inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { isD1MissingTableError } from "@/utils/d1-errors";
import {
	normalizeNigerianPhone,
	phoneNumberLookupValues,
} from "@/utils/nigerian-phone";

type Db = ReturnType<typeof drizzle>;

export type HellodutyContact = {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	alternativePhones: string[];
	verificationStatus: string;
	suspended: boolean;
};

function toContact(
	user: {
		id: string;
		name: string;
		email: string;
		mobileNumber: string | null;
		verificationStatus: string;
		suspended: boolean;
	},
	alternativePhones: string[],
): HellodutyContact {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		phone: user.mobileNumber,
		alternativePhones,
		verificationStatus: user.verificationStatus,
		suspended: user.suspended,
	};
}

async function loadAlternativePhones(db: Db, userId: string): Promise<string[]> {
	try {
		const rows = await db
			.select({ phoneE164: schema.userPhoneNumber.phoneE164 })
			.from(schema.userPhoneNumber)
			.where(eq(schema.userPhoneNumber.userId, userId));
		return rows.map((row) => row.phoneE164);
	} catch (error) {
		if (isD1MissingTableError(error)) return [];
		throw error;
	}
}

async function findUserIdByAlternativePhone(
	db: Db,
	lookupValues: string[],
): Promise<string | null> {
	if (lookupValues.length === 0) return null;
	try {
		const [row] = await db
			.select({ userId: schema.userPhoneNumber.userId })
			.from(schema.userPhoneNumber)
			.where(inArray(schema.userPhoneNumber.phoneE164, lookupValues))
			.limit(1);
		return row?.userId ?? null;
	} catch (error) {
		if (isD1MissingTableError(error)) return null;
		throw error;
	}
}

export async function findContactByPhone(
	db: Db,
	rawPhone: string,
): Promise<HellodutyContact | null> {
	const e164 = normalizeNigerianPhone(rawPhone);
	if (!e164) return null;

	const lookup = phoneNumberLookupValues(e164);
	const [byPrimary] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			mobileNumber: schema.user.mobileNumber,
			verificationStatus: schema.user.verificationStatus,
			suspended: schema.user.suspended,
		})
		.from(schema.user)
		.where(inArray(schema.user.mobileNumber, lookup))
		.limit(1);

	let user = byPrimary ?? null;
	if (!user) {
		const altUserId = await findUserIdByAlternativePhone(db, lookup);
		if (!altUserId) return null;
		const [byAlt] = await db
			.select({
				id: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
				mobileNumber: schema.user.mobileNumber,
				verificationStatus: schema.user.verificationStatus,
				suspended: schema.user.suspended,
			})
			.from(schema.user)
			.where(eq(schema.user.id, altUserId))
			.limit(1);
		user = byAlt ?? null;
	}

	if (!user) return null;
	const alternativePhones = await loadAlternativePhones(db, user.id);
	return toContact(user, alternativePhones);
}

export async function findContactById(
	db: Db,
	contactId: string,
): Promise<HellodutyContact | null> {
	const [user] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			mobileNumber: schema.user.mobileNumber,
			verificationStatus: schema.user.verificationStatus,
			suspended: schema.user.suspended,
		})
		.from(schema.user)
		.where(eq(schema.user.id, contactId))
		.limit(1);
	if (!user) return null;
	const alternativePhones = await loadAlternativePhones(db, user.id);
	return toContact(user, alternativePhones);
}

export type SaveAlternativeResult =
	| { ok: true; contact: HellodutyContact }
	| {
			ok: false;
			error:
				| "invalid_phone"
				| "contact_not_found"
				| "phone_taken"
				| "table_unavailable";
	  };

function phonesMatch(
	stored: string | null | undefined,
	e164: string,
): boolean {
	if (!stored?.trim()) return false;
	const storedE164 = normalizeNigerianPhone(stored);
	if (storedE164 && storedE164 === e164) return true;
	return phoneNumberLookupValues(e164).includes(stored.trim());
}

export async function saveAlternativePhone(
	db: Db,
	input: {
		contactId?: string;
		existingPhone?: string;
		alternativePhone: string;
	},
): Promise<SaveAlternativeResult> {
	const alternativeE164 = normalizeNigerianPhone(input.alternativePhone);
	if (!alternativeE164) return { ok: false, error: "invalid_phone" };

	let contact: HellodutyContact | null = null;
	if (input.contactId?.trim()) {
		contact = await findContactById(db, input.contactId.trim());
	} else if (input.existingPhone?.trim()) {
		contact = await findContactByPhone(db, input.existingPhone);
	}
	if (!contact) return { ok: false, error: "contact_not_found" };

	if (phonesMatch(contact.phone, alternativeE164)) {
		return { ok: true, contact };
	}
	if (contact.alternativePhones.some((phone) => phonesMatch(phone, alternativeE164))) {
		return { ok: true, contact };
	}

	const owner = await findContactByPhone(db, alternativeE164);
	if (owner && owner.id !== contact.id) {
		return { ok: false, error: "phone_taken" };
	}

	try {
		await db.insert(schema.userPhoneNumber).values({
			id: crypto.randomUUID(),
			userId: contact.id,
			phoneE164: alternativeE164,
		});
	} catch (error) {
		if (isD1MissingTableError(error)) {
			return { ok: false, error: "table_unavailable" };
		}
		const text = error instanceof Error ? error.message.toLowerCase() : String(error);
		if (text.includes("unique")) {
			const again = await findContactByPhone(db, alternativeE164);
			if (again && again.id === contact.id) {
				return { ok: true, contact: again };
			}
			return { ok: false, error: "phone_taken" };
		}
		throw error;
	}

	const updated = await findContactById(db, contact.id);
	return updated
		? { ok: true, contact: updated }
		: { ok: false, error: "contact_not_found" };
}
