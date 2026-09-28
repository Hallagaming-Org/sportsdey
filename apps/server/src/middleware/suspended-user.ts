import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { MiddlewareHandler } from "hono";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "@/types";

/**
 * Paths where a suspended account must not be able to move money, stake, or
 * hand itself off into a game provider. Provider callbacks that live under the
 * same prefixes run without a session user, so they are never affected.
 */
const GUARDED_PREFIXES = [
	"/wallet",
	"/sportsbook",
	"/hashcodex",
	"/casino",
	"/lagos-rush",
	"/halla",
	"/pockets",
	"/thndr",
	"/slotegrator",
	"/scorpio",
	"/swipegames",
	"/games",
	"/bills",
	"/handoff",
	"/bonus",
	"/loyalty",
	"/mission",
	"/tournament",
];

export const blockSuspendedUsers = (): MiddlewareHandler<{
	Bindings: CloudflareBindings;
}> => {
	return async (c, next) => {
		const user = c.get("user");
		if (!user) {
			return next();
		}

		const path = c.req.path;
		const guarded = GUARDED_PREFIXES.some(
			(prefix) =>
				path.startsWith(prefix) || path.startsWith(`/api${prefix}`),
		);
		if (!guarded) {
			return next();
		}

		const db = drizzle(c.env.DB, { schema });
		const [row] = await db
			.select({ suspended: schema.user.suspended })
			.from(schema.user)
			.where(eq(schema.user.id, user.id))
			.limit(1);

		if (row?.suspended) {
			return c.json(
				{
					success: false,
					error:
						"Your account is suspended. Please contact support for assistance.",
				},
				403,
			);
		}

		return next();
	};
};
