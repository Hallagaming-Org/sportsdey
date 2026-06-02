import { createServerFn } from "@tanstack/react-start";
import { client, urlFor } from "./sanity";

const SANITY_TIMEOUT = 5000;

async function fetchWithSanityTimeout<T>(query: string): Promise<T> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), SANITY_TIMEOUT);

	try {
		const result = await client.fetch<T>(query, {}, {
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		return result;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === "AbortError") {
			console.warn("Sanity API request timed out");
			throw new Error("Sanity request timed out");
		}
		throw error;
	}
}

export interface BannerData {
	_id: string;
	imageUrl: string;
	url: string;
	alt?: string;
}

export const getBanners = createServerFn({ method: "GET" })
	.inputValidator(() => undefined)
	.handler(async () => {
		const query = `*[_type == "banner"] | order(_createdAt desc)[0...10] {
			_id,
			image,
			url,
			alt
		}`;

		try {
			const response = await fetchWithSanityTimeout(query);

			if (!response || !Array.isArray(response) || response.length === 0) {
				return [];
			}

			const banners: BannerData[] = response
				.filter(
					(item: unknown) =>
						item && typeof item === "object" && "image" in item,
				)
				.map((item: Record<string, unknown>) => ({
					_id: item._id as string,
					url: (item.url as string) || "",
					alt: item.alt as string | undefined,
					imageUrl: urlFor(item.image).width(1200).url(),
				}));

			return banners;
		} catch {
			// Return empty array on error to prevent error boundary trigger
			return [];
		}
	});
