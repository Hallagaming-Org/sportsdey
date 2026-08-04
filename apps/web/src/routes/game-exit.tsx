import { createFileRoute, useRouter } from "@tanstack/react-router";

/**
 * Lightweight return target for Slotegrator when a provider closes the session
 * instead of loading the game. Kept bare (no site chrome) so it can safely
 * render inside the game iframe without nesting the full casino lobby.
 */
export const Route = createFileRoute("/game-exit")({
	component: GameExitPage,
});

function GameExitPage() {
	const router = useRouter();

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#121212] px-6 text-center">
			<p className="text-xl font-semibold text-white">
				This game could not start
			</p>
			<p className="max-w-md text-sm text-white/65">
				The provider closed the session before the game loaded. It may not be
				enabled for demo/real play on our Slotegrator contract yet.
			</p>
			<button
				type="button"
				onClick={() => router.navigate({ to: "/games" })}
				className="rounded-md bg-[#1BAA04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#158a03]"
			>
				Back to Casino
			</button>
		</div>
	);
}
