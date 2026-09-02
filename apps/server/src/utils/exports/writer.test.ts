import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderExportChunk } from "./writer";

describe("renderExportChunk pdf", () => {
	it("builds a Worker-safe PDF without Node __dirname", async () => {
		const rendered = await renderExportChunk("pdf", {
			headers: ["Transaction ID", "User Email", "Amount"],
			rows: [
				["tx-1", "yemi@example.com", "NGN 100.00"],
				["tx-2", "Adaorah Ńneka", "NGN 50.00"],
			],
		});
		const header = new TextDecoder().decode(rendered.bytes.slice(0, 5));
		assert.equal(header, "%PDF-");
		assert.equal(rendered.contentType, "application/pdf");
		assert.ok(rendered.bytes.length > 200);
	});
});
