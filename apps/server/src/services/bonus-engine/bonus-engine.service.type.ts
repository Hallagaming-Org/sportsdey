export type BonusEngineConfig = {
	baseUrl: string;
	clientId: string;
	projectId: string;
	clientSecret: string;
	privateKeyPem: string;
	callbackPublicKeyPem: string;
	currency: string;
};

export type BonusEngineApiResult<T = unknown> = {
	ok: boolean;
	status: number;
	data?: T;
	error?: string;
	message?: string;
};

export type BonusEngineAccessTokenResponse = {
	status?: number;
	token?: string;
	accessToken?: string;
	message?: string;
};

export type BonusEngineLoginInput = {
	userId: string;
	username: string;
	realWalletBalance: number;
	bonusWalletBalance: number;
	deposit?: number;
	sport?: string;
	currency?: string;
	paymentProvider?: string;
	deviceType?: string;
};

export type BonusEngineLoyaltyScopedBody = {
	client_id: string;
	project_id: string;
	user_id: string;
};

export type BonusEngineLoyaltyProjectBody = {
	client_id: string;
	project_id: string;
};

export type BonusEngineLoyaltyRedeemBody = BonusEngineLoyaltyScopedBody & {
	points_to_redeem: number;
	loyalty_id?: string;
};

export type BonusEngineLoyaltyCampaignItem = Record<string, unknown>;

export type BonusEngineLoyaltyPointsData = {
	player_id?: string;
	total_points?: number;
	loyalty_level?: string;
};

export type BonusEngineLoyaltyRedeemData = {
	player_id?: string;
	total_points?: number;
	redeemed_points?: number;
	loyalty_level?: string;
};

export type BonusEngineLoyaltyHistoryItem = {
	player_id?: string;
	points_earned?: number;
	points_redeemed?: number;
	points_balance?: number;
	transaction_type?: string;
	reason?: string;
	transaction_date?: string;
};

export type BonusEngineMissionListItem = Record<string, unknown>;

export type BonusEngineReportDepositInput = {
	userId: string;
	amount: number;
	transactionId: string;
	currency?: string;
};

export type BonusEngineReportBetInput = {
	userId: string;
	betId: string;
	amount: number;
	productType: string;
	currency?: string;
	providerId?: string;
	gameId?: string;
};

export type BonusEngineLoyaltyPointsUpdatePayload = {
	player_id: string;
	loyalty_points: number;
	level: string;
};

export type BonusEngineLoyaltyLevelUpPayload = {
	player_id: string;
	new_level: string;
};

export type BonusEngineMissionProgressPayload = {
	mission_id: string;
	player_id: string;
	progress_percentage: number;
};

export type BonusEngineMissionCompletePayload = {
	mission_id: string;
	player_id: string;
	reward?: {
		type?: string;
		value?: number;
	};
};

export type BonusEngineBalanceCallbackPayload = {
	user_id: string;
};
