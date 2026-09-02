import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveScorpioGameImage } from "./scorpio-image";

describe("resolveScorpioGameImage", () => {
	it("keeps a plain URL string", () => {
		assert.equal(
			resolveScorpioGameImage("https://amuse-gc.example/619.jpg"),
			"https://amuse-gc.example/619.jpg",
		);
	});

	it("unwraps nested EGT-style image maps", () => {
		assert.equal(
			resolveScorpioGameImage({
				mobile: { squareTile: "https://cdn.example/heart-square.jpg" },
			}),
			"https://cdn.example/heart-square.jpg",
		);
	});

	it("walks unknown nested objects for an http URL", () => {
		assert.equal(
			resolveScorpioGameImage({
				foo: { bar: "https://cdn.example/deep.png" },
			}),
			"https://cdn.example/deep.png",
		);
	});

	it("returns null for empty nested objects (the old sync bug)", () => {
		assert.equal(resolveScorpioGameImage({ mobile: {} }), null);
		assert.equal(resolveScorpioGameImage(undefined), null);
	});

	it("rejects relative paths that would 404 on sportsdey.com", () => {
		assert.equal(resolveScorpioGameImage("/game_pic/foo.jpg"), null);
		assert.equal(resolveScorpioGameImage("game_pic/foo.jpg"), null);
	});

	it("upgrades http thumbnails to https", () => {
		assert.equal(
			resolveScorpioGameImage("http://cdn.example/tile.jpg"),
			"https://cdn.example/tile.jpg",
		);
	});
});
