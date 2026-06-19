import { createFileRoute, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/game/$gameId")({
	component: GamePage,
});

function GamePage() {
	const { gameId } = Route.useParams();
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

	return (
		<div className="relative h-screen w-full">
			{isIframeLoading && (
				<div className="absolute inset-4 z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1BAA04]/50 bg-[#121212]/80 backdrop-blur-sm">
					<Loader2 className="mb-4 h-10 w-10 animate-spin text-[#1BAA04]" />
					<p className="font-medium text-lg text-white">Game is launching...</p>
					<p className="mt-2 text-gray-400 text-sm">Please wait while we set things up</p>
				</div>
			)}
			<iframe
				src={gameUrl}
				className={cn(
					"h-screen w-full border-0 transition-opacity duration-500",
					isIframeLoading ? "opacity-0" : "opacity-100",
				)}
				title={gameId}
				allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				onLoad={() => setIsIframeLoading(false)}
			/>
		</div>
	);
}
