import { apiRequest } from "./api";

// const SANITY_TIMEOUT = 5000;

// async function fetchWithSanityTimeout<T>(query: string): Promise<T> {
// 	const controller = new AbortController();
// 	const timeoutId = setTimeout(() => controller.abort(), SANITY_TIMEOUT);

// 	try {
// 		const result = await client.fetch<T>(query, {}, {
// 			signal: controller.signal,
// 		});
// 		clearTimeout(timeoutId);
// 		return result;
// 	} catch (error) {
// 		clearTimeout(timeoutId);
// 		if (error instanceof Error && error.name === "AbortError") {
// 			console.warn("Sanity API request timed out");
// 			throw new Error("Sanity request timed out");
// 		}
// 		throw error;
// 	}
// }

export interface BannerData {
	_id: string;
	imageUrl: string;
	url: string;
	alt?: string;
}

export async function getBanners(): Promise<BannerData[]> {
	try {
		return await apiRequest<BannerData[]>("cms/public/banners");
	} catch {
		return [];
	}
}
