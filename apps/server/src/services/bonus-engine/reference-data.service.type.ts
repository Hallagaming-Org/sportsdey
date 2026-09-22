export type BonusEngineGameProviderItem = {
	name: string;
	unique_id: string;
	is_live_game: number;
};

export type BonusEngineGameItem = {
	provider_unique_id: string;
	name: string;
	unique_id: string;
	free_spin: number;
};

export type BonusEngineSportItem = {
	SportId: number;
	Name: string;
};

export type BonusEngineSportCategoryItem = {
	categoryId: number;
	name: string;
};

export type BonusEngineChampionshipItem = {
	championshipId: number | string;
	name: string;
};

export type BonusEngineChampionshipRow = {
	sportId: number;
	categoryId: number;
	championshipId: number | string;
	name: string;
};

export type BonusEngineSportEventItem = {
	EventId: number;
	EventName: string;
};

export type BonusEngineEventMarketItem = {
	EventId: number;
	EventName: string;
	MarketId?: number;
	MarketName?: string;
};
