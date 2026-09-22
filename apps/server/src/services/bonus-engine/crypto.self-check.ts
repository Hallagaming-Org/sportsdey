/**
 * Self-check for Bonus Engine RSA-SHA256 sign/verify and idempotency hashing.
 * Run from apps/server: `pnpm exec tsx src/services/bonus-engine/crypto.self-check.ts`
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
	hashBonusEngineIdempotencyKey,
	signBonusEngineBody,
	verifyBonusEngineBody,
	verifyBonusEngineSecureDataHeader,
} from "./crypto";

async function main() {
	const { publicKey, privateKey } = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});

	const body = JSON.stringify({
		client_id: "client123",
		project_id: "project123",
		user_id: "user123",
	});

	const signature = await signBonusEngineBody({
		privateKeyPem: privateKey,
		bodyString: body,
	});
	assert.ok(signature.length > 0, "signature should be non-empty");

	const valid = await verifyBonusEngineBody({
		publicKeyPem: publicKey,
		bodyString: body,
		signatureBase64: signature,
	});
	assert.equal(valid, true, "valid signature must verify");

	const tampered = await verifyBonusEngineBody({
		publicKeyPem: publicKey,
		bodyString: `${body} `,
		signatureBase64: signature,
	});
	assert.equal(tampered, false, "tampered body must fail verification");

	const hashA = await hashBonusEngineIdempotencyKey("mission.complete:m1:u1");
	const hashB = await hashBonusEngineIdempotencyKey("mission.complete:m1:u1");
	const hashC = await hashBonusEngineIdempotencyKey("mission.complete:m1:u2");
	assert.equal(hashA, hashB, "idempotency hash must be stable");
	assert.notEqual(hashA, hashC, "different seeds must hash differently");
	assert.equal(hashA.length, 64, "sha-256 hex length");

	const secureData = await signBonusEngineBody({
		privateKeyPem: privateKey,
		bodyString: "X-Secure-Data",
	});
	const secureOk = await verifyBonusEngineSecureDataHeader({
		headerValue: secureData,
		privateKeyPem: privateKey,
		callbackPublicKeyPem: publicKey,
	});
	assert.equal(secureOk, true, "X-Secure-Data header must verify");

	console.log("bonus-engine crypto self-check passed");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
