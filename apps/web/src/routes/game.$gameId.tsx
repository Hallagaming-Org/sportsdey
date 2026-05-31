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
	const gameUrl = location.state?.gameUrl as string | undefined;
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
				<div className="absolute inset-0 flex items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
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
