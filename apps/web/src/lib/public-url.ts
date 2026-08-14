/**
 * Public site origin from `VITE_PUBLIC_URL` (no trailing slash).
 * Staging may set the var with or without a trailing slash; callers must not
 * concatenate bare path segments onto this value.
 */
export function resolvePublicUrl(): string {
	const configured = import.meta.env.VITE_PUBLIC_URL ?? "";
	return configured.replace(/\/$/, "");
}

/**
 * Joins the public site origin with a path, guaranteeing exactly one slash.
 */
export function buildPublicUrl(path: string): string {
	const origin = resolvePublicUrl();
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${origin}${normalizedPath}`;
}
