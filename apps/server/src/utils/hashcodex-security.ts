import { createHmac, timingSafeEqual } from "node:crypto";

export const HASHCODEX_SIGNATURE_HEADER = "x-hashcodex-signature";

export class HashcodexSignatureError extends Error {
	constructor(message = "Invalid Hashcodex request signature") {
		super(message);
		this.name = "HashcodexSignatureError";
	}
}

export function computeHashcodexSignature(
	rawBody: string,
	secret: string,
): string {
	return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyHashcodexSignature(
	rawBody: string,
	receivedSignature: string | undefined,
	secret: string | undefined,
): void {
	if (!secret?.trim()) {
		throw new HashcodexSignatureError(
			"Hashcodex server secret is not configured",
		);
	}
	if (!receivedSignature?.trim()) {
		throw new HashcodexSignatureError(
			`Missing ${HASHCODEX_SIGNATURE_HEADER} header`,
		);
	}

	const expected = computeHashcodexSignature(rawBody, secret);
	const received = receivedSignature.trim().toLowerCase();
	const expectedBuf = Buffer.from(expected, "utf8");
	const receivedBuf = Buffer.from(received, "utf8");

	if (
		expectedBuf.length !== receivedBuf.length ||
		!timingSafeEqual(expectedBuf, receivedBuf)
	) {
		throw new HashcodexSignatureError();
	}
}
