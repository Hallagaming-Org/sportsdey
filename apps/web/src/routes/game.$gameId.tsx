import { createFileRoute, useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/game/$gameId")({
	component: GamePage,
	validateSearch: (search: Record<string, unknown>): { category?: string } => ({
		category: (search.category as string) || undefined,
	}),
});

function GamePage() {
	const { gameId } = Route.useParams();
	const { category } = Route.useSearch();
	const location = useLocation();
	const gameUrl = (location.state as { gameUrl?: string })?.gameUrl;
	const [isIframeLoading, setIsIframeLoading] = useState(true);

	useEffect(() => {
		if (!gameUrl) return;

		setIsIframeLoading(true);
		const timer = setTimeout(() => setIsIframeLoading(false), 5000);

		return () => clearTimeout(timer);
	}, [gameUrl]);

	if (!gameUrl) {
		return (
			<div className="flex h-screen items-center justify-center">
				<p className="text-primary text-xl">Loading game...</p>
			</div>
		);
	}

	const router = useRouter();

	return (
		<div className="relative flex h-full w-full flex-col">
			<div className="flex shrink-0 items-center bg-[#121212] px-4 py-3">
				<button
					type="button"
					onClick={() =>
						router.navigate({
							to: "/games",
							search: { category },
						})
					}
					className="flex cursor-pointer items-center gap-2 font-medium text-white transition-colors hover:text-[#1BAA04]"
				>
					<ArrowLeft className="h-5 w-5" />
					<span>Back to Games</span>
				</button>
			</div>
			<div className="relative w-full flex-1">
				{isIframeLoading && (
					<div className="absolute inset-4 z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-[#1BAA04]/50 border-dashed bg-[#121212]/80 backdrop-blur-sm">
						<Loader2 className="mb-4 h-10 w-10 animate-spin text-[#1BAA04]" />
						<p className="font-medium text-lg text-white">Game is launching...</p>
					</div>
				)}
				<iframe
					src={gameUrl}
					className={cn(
						"h-full w-full border-0 transition-opacity duration-500",
						isIframeLoading ? "opacity-0" : "opacity-100",
					)}
					title={gameId}
					allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					onLoad={() => setIsIframeLoading(false)}
				/>
			</div>
		</div>
	);
}
