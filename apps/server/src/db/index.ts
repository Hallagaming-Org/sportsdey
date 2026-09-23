import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export * from "./schema";

/** Bind schema so `db.query.bonusEngine*` relational reads work. */
export const createDb = (db: D1Database) => {
	return drizzle(db, { schema });
};
