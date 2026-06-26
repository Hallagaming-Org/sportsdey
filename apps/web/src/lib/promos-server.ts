import { apiRequest } from "./api";

export type PromoListItem = {
	_id: string;
	imageUrl: string;
	title: string;
	endDate: string;
};

export type PromoBannerImage = {
	url: string;
	alt?: string;
};

export type PromoDetail = {
	_id: string;
	bannerImages: PromoBannerImage[];
	title: string;
	endDate: string;
	body: unknown;
	type: string;
};

export async function getPromos(params: {
	type?: string;
	offset?: number;
	limit?: number;
}): Promise<PromoListItem[]> {
	const query = new URLSearchParams({
		type: params.type ?? "all",
		offset: String(params.offset ?? 0),
		limit: String(params.limit ?? 20),
	});
	return apiRequest<PromoListItem[]>(`cms/public/promos?${query.toString()}`);
}

export async function getPromoById(id: string): Promise<PromoDetail | null> {
	return apiRequest<PromoDetail | null>(
		`cms/public/promos/${encodeURIComponent(id)}`,
	);
}
