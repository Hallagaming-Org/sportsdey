/**
 * Apple and Facebook OAuth are not ready on production.
 * Staging and local `vite dev` still show those buttons.
 */
export function showAppleFacebookLogin(): boolean {
	return import.meta.env.MODE !== "production";
}
