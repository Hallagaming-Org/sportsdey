import { getSanityImageUrlBuilder, type CloudflareBindings } from "./sanity";

export type ImageSizes = {
	url: string;
	thumb: string;
	card: string;
	hero: string;
	og: string;
};

export function toImageSizes(
	env: CloudflareBindings,
	source: unknown,
): ImageSizes | null {
	if (!source) return null;
	const builder = getSanityImageUrlBuilder(env);
	const img = builder.image(
		source as Parameters<typeof builder.image>[0],
	);
	return {
		url: img.url(),
		thumb: img.width(200).height(200).url(),
		card: img.width(800).height(450).url(),
		hero: img.width(1200).height(630).url(),
		og: img.width(1200).height(630).url(),
	};
}
