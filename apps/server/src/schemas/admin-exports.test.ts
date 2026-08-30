import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CreateExportSchema } from "./admin-exports";

describe("CreateExportSchema", () => {
	it("accepts an empty filters object", () => {
		const parsed = CreateExportSchema.parse({
			source: "transactions",
			format: "xlsx",
			filters: {},
		});
		assert.deepEqual(parsed.filters, {});
	});

	it("drops null and empty filter values from the admin UI", () => {
		const parsed = CreateExportSchema.parse({
			source: "transactions",
			format: "pdf",
			filters: {
				type: null,
				status: undefined,
				search: "",
				fromDate: null,
				toDate: "2026-08-01T00:00:00.000Z",
			},
		});
		assert.deepEqual(parsed.filters, {
			toDate: "2026-08-01T00:00:00.000Z",
		});
	});

	it("defaults missing filters to an empty object", () => {
		const parsed = CreateExportSchema.parse({
			source: "users",
			format: "docx",
		});
		assert.deepEqual(parsed.filters, {});
	});
});
