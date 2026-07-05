import { createFileRoute, useLocation, useRouter } from "@tanstack/react-router";
import { Loader2, ArrowLeft } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/game/$gameId")({
	component: GamePage,
	validateSearch: (search: Record<string, unknown>): { category?: string } => ({
		category: (search.category as string) || undefined,
	}),
});

const LANDSCAPE_GAMES = ["LAGOSRUSH", "sportsdey-crash"];

function GamePage() {
	const { gameId } = Route.useParams();
	const { category } = Route.useSearch();
	const location = useLocation();
	const gameUrl = (location.state as { gameUrl?: string })?.gameUrl;
	const [isIframeLoading, setIsIframeLoading] = useState(true);

	const isLandscapeGame = LANDSCAPE_GAMES.includes(gameId);
	const [isPortrait, setIsPortrait] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const checkOrientation = () => {
			setIsPortrait(window.innerHeight > window.innerWidth);
		};
		
		checkOrientation();
		window.addEventListener("resize", checkOrientation);
		return () => window.removeEventListener("resize", checkOrientation);
	}, []);

	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver((entries) => {
			for (let entry of entries) {
				setContainerSize({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	const shouldForceLandscape = isLandscapeGame && isPortrait;

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
		<div className="relative h-full w-full flex flex-col">
			<div className="bg-[#121212] flex items-center px-4 py-3 shrink-0">
				<button 
					onClick={() => router.navigate({ to: "/games", search: { category } })}
					className="flex items-center gap-2 text-white hover:text-[#1BAA04] transition-colors cursor-pointer font-medium"
				>
					<ArrowLeft className="h-5 w-5" />
					<span>Back to Games</span>
				</button>
			</div>
			<div className="relative flex-1 w-full" ref={containerRef}>
				{isIframeLoading && (
					<div className="absolute inset-4 z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1BAA04]/50 bg-[#121212]/80 backdrop-blur-sm">
						<Loader2 className="mb-4 h-10 w-10 animate-spin text-[#1BAA04]" />
						<p className="font-medium text-lg text-white">Game is launching...</p>
						<p className="mt-2 text-gray-400 text-sm">Please wait while we set things up</p>
					</div>
				)}
				<iframe
					src={gameUrl}
					style={
						shouldForceLandscape
							? {
									position: "absolute",
									top: "50%",
									left: "50%",
									width: `${containerSize.height}px`,
									height: `${containerSize.width}px`,
									transform: "translate(-50%, -50%) rotate(90deg)",
							  }
							: undefined
					}
					className={cn(
						"border-0 transition-opacity duration-500",
						isIframeLoading ? "opacity-0" : "opacity-100",
						!shouldForceLandscape && "h-full w-full"
					)}
					title={gameId}
					allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					onLoad={() => setIsIframeLoading(false)}
				/>
			</div>
		</div>
	);
}
