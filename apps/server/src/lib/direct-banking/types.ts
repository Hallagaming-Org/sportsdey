export interface DirectBankingProvider {
	initiateDebit(params: { userId: string; amount: number; reference: string }): Promise<{ redirectUrl: string }>;
	verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean;
}