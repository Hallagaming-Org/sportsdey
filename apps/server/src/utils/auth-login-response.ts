import { z } from "@hono/zod-openapi";

/**
 * Better Auth `/get-session` (OAuth) session object.
 * Phone login returns this same shape so mobile can parse one response builder.
 */
export const AuthSessionSchema = z.object({
	id: z.string(),
	token: z.string(),
	userId: z.string(),
	expiresAt: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	ipAddress: z.string().nullable().optional(),
	userAgent: z.string().nullable().optional(),
});

/**
 * Better Auth session `user` (+ returned additionalFields).
 * Includes `emailVerified` (mobile "IsVerified" path).
 */
export const AuthLoginUserSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	mobileNumber: z.string().nullable().optional(),
	dob: z.string().nullable().optional(),
	verificationStatus: z.string().optional(),
	country: z.string().nullable().optional(),
});

/**
 * Phone login `data` = carbon copy of Better Auth OAuth get-session
 * (`session` + `user`), plus small phone-flow helpers for web.
 */
export const AuthLoginDataSchema = z.object({
	session: AuthSessionSchema,
	user: AuthLoginUserSchema,
	/** Alias of `session.token` for older phone clients / web helpers. */
	token: z.string(),
	message: z.string().optional(),
	isFirstTimeSignIn: z.boolean().optional(),
	needsProfileCompletion: z.boolean().optional(),
});

export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type AuthLoginUser = z.infer<typeof AuthLoginUserSchema>;
export type AuthLoginData = z.infer<typeof AuthLoginDataSchema>;

export function toIsoTimestamp(value: Date | string | number): string {
	if (value instanceof Date) return value.toISOString();
	return new Date(value).toISOString();
}

/** Maps a DB user row into the Better Auth session `user` object. */
export function buildAuthLoginUser(user: {
	id: string;
	name: string;
	email: string;
	emailVerified?: boolean | null;
	image?: string | null;
	createdAt: Date | string | number;
	updatedAt?: Date | string | number | null;
	mobileNumber?: string | null;
	dob?: string | null;
	verificationStatus?: string | null;
	country?: string | null;
}): AuthLoginUser {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		emailVerified: Boolean(user.emailVerified),
		image: user.image ?? null,
		createdAt: toIsoTimestamp(user.createdAt),
		updatedAt: toIsoTimestamp(user.updatedAt ?? user.createdAt),
		mobileNumber: user.mobileNumber ?? null,
		dob: user.dob ?? null,
		verificationStatus: user.verificationStatus ?? undefined,
		country: user.country ?? null,
	};
}

export function buildAuthSession(input: {
	id: string;
	token: string;
	userId: string;
	expiresAt: Date | string;
	createdAt?: Date | string;
	updatedAt?: Date | string;
	ipAddress?: string | null;
	userAgent?: string | null;
}): AuthSession {
	const createdAt = input.createdAt ?? new Date();
	const updatedAt = input.updatedAt ?? createdAt;
	return {
		id: input.id,
		token: input.token,
		userId: input.userId,
		expiresAt: toIsoTimestamp(input.expiresAt),
		createdAt: toIsoTimestamp(createdAt),
		updatedAt: toIsoTimestamp(updatedAt),
		ipAddress: input.ipAddress ?? null,
		userAgent: input.userAgent ?? null,
	};
}

/**
 * Builds the OAuth/Better Auth get-session carbon copy for phone login.
 */
export function buildAuthLoginResponse(input: {
	session: {
		id: string;
		token: string;
		userId: string;
		expiresAt: Date | string;
		createdAt?: Date | string;
		updatedAt?: Date | string;
		ipAddress?: string | null;
		userAgent?: string | null;
	};
	user: Parameters<typeof buildAuthLoginUser>[0];
	message?: string;
	isFirstTimeSignIn?: boolean;
	needsProfileCompletion?: boolean;
}): AuthLoginData {
	const session = buildAuthSession(input.session);
	const isFirstTimeSignIn = Boolean(input.isFirstTimeSignIn);
	return {
		session,
		user: buildAuthLoginUser(input.user),
		token: session.token,
		message: input.message ?? "Sign-in successful.",
		isFirstTimeSignIn,
		needsProfileCompletion:
			input.needsProfileCompletion ?? isFirstTimeSignIn,
	};
}
