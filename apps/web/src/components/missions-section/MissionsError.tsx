import { ApiError } from "@/lib/api";

type MissionsErrorProps = {
	error: unknown;
};

export function MissionsError({ error }: MissionsErrorProps) {
	return (
		<div className="flex justify-center py-12 text-red-400">
			{error instanceof ApiError
				? error.message
				: "Could not load missions. Try again later."}
		</div>
	);
}
