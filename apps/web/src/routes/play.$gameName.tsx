import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type Game = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	category: string | null;
	enabled: boolean;
};

type LaunchResponse = {
	success: boolean;
	data: { url?: string } | undefined;
	error?: string;
};

export const Route = createFileRoute("/play/$gameName")({
	component: PlayGamePage,
});

const KNOWN_GAMES_LIST = [
	"solitaire",
	"blocks",
	"twentyone",
	"blackjack",
	"slots",
	"plinko",
	"XCAPEHB",
	"EAGLEHB",
	"LUCKYRISEHB",
	"LAGOSRUSH",
];

function PlayGamePage() {
	const { gameName } = Route.useParams();
	const navigate = useNavigate();
	const { data: session, isPending: isSessionLoading } = useSession();

	const [isPlayClicked, setIsPlayClicked] = useState(false);
	const [gameUrl, setGameUrl] = useState<string | null>(null);
	const [isIframeLoading, setIsIframeLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const { data: games = [], isLoading: isGamesLoading } = useQuery<Game[]>({
		queryKey: ["games"],
		queryFn: async () => {
			const data = await apiRequest<Game[]>("games");
			return data.filter((g) => g.enabled);
		},
		enabled: !!session?.user,
	});

	useEffect(() => {
		if (isSessionLoading) return;

		if (!session?.user) {
			navigate({ to: "/auth/sign-in", replace: true });
			return;
		}
	}, [session, isSessionLoading, navigate]);

	const decodedGameName = decodeURIComponent(gameName);
	const searchName = decodedGameName.toLowerCase().replace(/[-_]/g, " ");
	const searchCode = searchName.replace(/\s/g, "");

	const targetGame = games.find(
		(g) =>
			g.name.toLowerCase() === searchName ||
			g.name.toLowerCase().includes(searchName) ||
			g.code.toLowerCase() === searchCode
	);

	useEffect(() => {
		let isMounted = true;

		const launchGame = async () => {
			if (!targetGame) {
				setError(`Game "${searchName}" not found.`);
				return;
			}

			try {
				let url: string;
				let body: Record<string, unknown>;

				const isKnownGame = KNOWN_GAMES_LIST.includes(targetGame.code);

				if (isKnownGame) {
					if (["XCAPEHB", "EAGLEHB", "LUCKYRISEHB"].includes(targetGame.code)) {
						url = `${import.meta.env.VITE_SERVER_URL}casino/play/${targetGame.code}`;
						body = {};
					} else if (targetGame.code === "LAGOSRUSH") {
						url = `${import.meta.env.VITE_SERVER_URL}lagos-rush/launcher`;
						body = { game: targetGame.code };
					} else {
						url = `${import.meta.env.VITE_SERVER_URL}thndr/play/${targetGame.code}`;
						body = {};
					}
				} else {
					url = `${import.meta.env.VITE_SERVER_URL}slotegrator/launch`;
					body = { game_uuid: targetGame.code };
				}

				const response = await fetch(url, {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				const data: LaunchResponse = await response.json();

				if (!response.ok || data.success === false) {
					if (data.error === "Unauthorized" || response.status === 401) {
						if (isMounted) navigate({ to: "/auth/sign-in" });
						return;
					}
					throw new Error(data.error || "Failed to launch game");
				}

				if (!data.data?.url) {
					throw new Error("Missing launch URL in response");
				}

				if (isMounted) {
					setGameUrl(data.data.url);
					// Fallback to remove loader if iframe fails to trigger onLoad
					setTimeout(() => {
						if (isMounted) setIsIframeLoading(false);
					}, 5000);
				}
			} catch (err: any) {
				if (isMounted) {
					setError(err.message || "Something went wrong.");
				}
			}
		};

		if (isPlayClicked && targetGame && !gameUrl && !error) {
			launchGame();
		}

		return () => {
			isMounted = false;
		};
	}, [isPlayClicked, targetGame, gameUrl, error, navigate, searchName]);

	const formattedGameName = decodedGameName
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());

	if (isSessionLoading || isGamesLoading) {
		return (
			<div className="flex h-full min-h-[50vh] items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="h-10 w-10 animate-spin text-[#1BAA04]" />
					<p className="font-medium text-lg text-gray-900 dark:text-white">
						Loading {formattedGameName}...
					</p>
				</div>
			</div>
		);
	}

	if (!targetGame && !error) {
		return (
			<div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4">
				<p className="text-red-500 text-lg">Game "{formattedGameName}" not found.</p>
				<button
					onClick={() => navigate({ to: "/games" })}
					className="rounded-lg bg-[#1BAA04] px-6 py-2 font-medium text-white transition-colors hover:bg-[#158a03]"
				>
					Back to Casino
				</button>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4">
				<p className="text-red-500 text-lg">{error}</p>
				<button
					onClick={() => navigate({ to: "/games" })}
					className="rounded-lg bg-[#1BAA04] px-6 py-2 font-medium text-white transition-colors hover:bg-[#158a03]"
				>
					Back to Casino
				</button>
			</div>
		);
	}

	if (!isPlayClicked) {
		return (
			<div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center pt-8">
				<div className="w-full overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800">
					<div className="relative aspect-video w-full bg-gray-900">
						{targetGame?.imageUrl ? (
							<img
								src={targetGame.imageUrl}
								alt={targetGame.name}
								className="h-full w-full object-cover opacity-80"
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
								<p className="text-xl font-bold text-white/50">{targetGame?.name}</p>
							</div>
						)}
						<div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent opacity-90" />
					</div>

					<div className="relative -mt-12 flex flex-col items-center px-6 pb-10 text-center sm:-mt-16 sm:px-10">
						<div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-[#1a1a1a] bg-gray-900 shadow-xl sm:h-28 sm:w-28">
							{targetGame?.imageUrl ? (
								<img
									src={targetGame.imageUrl}
									alt={targetGame.name}
									className="h-full w-full object-cover"
								/>
							) : (
								<p className="font-bold text-white/50">Logo</p>
							)}
						</div>

						<h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white sm:text-5xl">
							{targetGame?.name}
						</h1>
						{/* {targetGame?.category && (
							<p className="mb-8 text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
								{targetGame.category}
							</p>
						)} */}

						<button
							onClick={() => setIsPlayClicked(true)}
							className="cursor-pointer group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[#1BAA04] px-12 py-4 font-bold text-white transition-all hover:scale-105 hover:bg-[#158a03] hover:shadow-[0_0_20px_rgba(27,170,4,0.4)] active:scale-95"
						>
							<span className="relative flex items-center gap-2 text-lg">
								PLAY NOW
								<svg
									className="h-5 w-5 transition-transform group-hover:translate-x-1"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
								</svg>
							</span>
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-screen w-full bg-[#121212] overflow-hidden rounded-xl mt-4 border border-gray-800">
			{isIframeLoading && (
				<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#121212]/90 backdrop-blur-sm">
					<Loader2 className="mb-4 h-12 w-12 animate-spin text-[#1BAA04]" />
					<p className="font-medium text-xl text-white">
						{targetGame?.name || formattedGameName} is launching...
					</p>
					<p className="mt-2 text-gray-400">
						Please wait while we set things up
					</p>
				</div>
			)}
			{gameUrl && (
				<iframe
					src={gameUrl}
					className={cn(
						"h-full w-full border-0 transition-opacity duration-500",
						isIframeLoading ? "opacity-0" : "opacity-100",
					)}
					title={targetGame?.name || formattedGameName}
					allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					onLoad={() => setIsIframeLoading(false)}
				/>
			)}
		</div>
	);
}

