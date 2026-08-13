import { ApiError } from "@/lib/api";

type MissionsPreviewBannerProps = {
	error: unknown;
};

export function MissionsPreviewBanner({ error }: MissionsPreviewBannerProps) {
	const statusSuffix =
		error instanceof ApiError && error.status ? ` (${error.status})` : "";

	return (
		<div className="mb-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[#A8FF9E] text-sm">
			Preview mode — live missions API is unavailable{statusSuffix}. Showing
			sample cards.
		</div>
	);
}
