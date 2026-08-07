import { ApiError } from "@/lib/api";

type MissionsErrorProps = {
	error: unknown;
};

/**
 * Empty-state error when the missions list API is unavailable or fails.
 */
export function MissionsError({ error }: MissionsErrorProps) {
	return (
		<div className="flex justify-center py-12 text-red-400">
			{error instanceof ApiError
				? error.message
				: "Could not load missions. Try again later."}
		</div>
	);
}
