import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import type { CloudflareBindings } from "../types";

const SANITY_PROJECT_ID = "en1qcqbd";
const SANITY_DATASET = "production";

export function getSanityClient(_env: CloudflareBindings) {
	return createClient({
		projectId: SANITY_PROJECT_ID,
		dataset: SANITY_DATASET,
		apiVersion: "2024-01-01",
		useCdn: false,
	});
}

export function getSanityServerClient(env: CloudflareBindings) {
	const token = env.SANITY_WRITE_TOKEN;
	return createClient({
		projectId: SANITY_PROJECT_ID,
		dataset: SANITY_DATASET,
		apiVersion: "2024-01-01",
		useCdn: false,
		token,
	});
}

let builder: ReturnType<typeof createImageUrlBuilder> | null = null;

export function getSanityImageUrlBuilder(env: CloudflareBindings) {
	if (!builder) {
		const client = getSanityClient(env);
		builder = createImageUrlBuilder(client);
	}
	return builder;
}

export function urlFor(env: CloudflareBindings, source: unknown) {
	return getSanityImageUrlBuilder(env).image(source as Parameters<typeof createImageUrlBuilder>[0]);
}