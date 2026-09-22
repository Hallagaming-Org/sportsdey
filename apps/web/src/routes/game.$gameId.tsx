import { createFileRoute, useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mustOpenCasinoGameTopLevel } from "@/lib/classic-lobby-codes";
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
	const openTopLevel = mustOpenCasinoGameTopLevel(gameId, gameUrl);
	const [isIframeLoading, setIsIframeLoading] = useState(true);
	const [bouncedHome, setBouncedHome] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const router = useRouter();

	useEffect(() => {
		if (!gameUrl || !openTopLevel) return;
		window.location.replace(gameUrl);
	}, [gameUrl, openTopLevel]);

	useEffect(() => {
		if (!gameUrl || openTopLevel) return;

		setIsIframeLoading(true);
		setBouncedHome(false);
		const timer = setTimeout(() => setIsIframeLoading(false), 5000);

		return () => clearTimeout(timer);
	}, [gameUrl, openTopLevel]);

	useEffect(() => {
		if (gameUrl) return;
		// History state is lost on refresh; send players back to the lobby.
		const timer = window.setTimeout(() => {
			router.navigate({
				to: "/games",
				search: { category },
				replace: true,
			});
		}, 1500);
		return () => window.clearTimeout(timer);
	}, [gameUrl, router, category]);

	const checkIframeBounce = () => {
		setIsIframeLoading(false);
		const frame = iframeRef.current;
		if (!frame) return;
		try {
			const href = frame.contentWindow?.location?.href;
			if (!href || href === "about:blank") return;
			const origin = new URL(href).origin;
			// GIS exit → our return_url lands same-origin inside the iframe.
			if (origin === window.location.origin) {
				setBouncedHome(true);
			}
		} catch {
			// Cross-origin game host — expected while the real game is running.
		}
	};

	if (openTopLevel && gameUrl) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-2 px-4 text-center">
				<Loader2 className="mb-2 h-10 w-10 animate-spin text-[#1BAA04]" />
				<p className="text-primary text-xl">Opening game...</p>
				<p className="text-sm text-white/60">
					This title cannot run inside the lobby. Continuing to the game.
				</p>
			</div>
		);
	}

	if (!gameUrl) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-2 px-4 text-center">
				<p className="text-primary text-xl">Loading game...</p>
				<p className="text-sm text-white/60">
					If nothing starts, you&apos;ll be returned to the casino lobby.
				</p>
			</div>
		);
	}

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
				{bouncedHome ? (
					<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
						<p className="text-xl font-semibold text-white">
							This game could not start
						</p>
						<p className="max-w-md text-sm text-white/65">
							The provider closed the session before the game loaded. Use Back
							to Games and press Play again — do not use Reload on this screen.
						</p>
						<button
							type="button"
							onClick={() =>
								router.navigate({
									to: "/games",
									search: { category },
								})
							}
							className="rounded-md bg-[#1BAA04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#158a03]"
						>
							Back to Casino
						</button>
					</div>
				) : (
					<>
						{isIframeLoading && (
							<div className="absolute inset-4 z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-[#1BAA04]/50 border-dashed bg-[#121212]/80 backdrop-blur-sm">
								<Loader2 className="mb-4 h-10 w-10 animate-spin text-[#1BAA04]" />
								<p className="font-medium text-lg text-white">
									Game is launching...
								</p>
							</div>
						)}
						<iframe
							ref={iframeRef}
							src={gameUrl}
							className={cn(
								"h-full w-full border-0 transition-opacity duration-500",
								isIframeLoading ? "opacity-0" : "opacity-100",
							)}
							title={gameId}
							allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							onLoad={checkIframeBounce}
						/>
					</>
				)}
			</div>
		</div>
	);
}
