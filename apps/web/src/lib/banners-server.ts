import { apiRequest } from "./api";

export interface BannerData {
	_id: string;
	imageUrl: string;
	url: string;
	alt?: string;
}

export async function getBanners(): Promise<BannerData[]> {
	return apiRequest<BannerData[]>("cms/public/banners");
}
