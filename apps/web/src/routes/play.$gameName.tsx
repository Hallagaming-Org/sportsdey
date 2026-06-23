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
	"LAGOSRUSH"
];

function PlayGamePage() {
	const { gameName } = Route.useParams();
	const navigate = useNavigate();
	const { data: session, isPending: isSessionLoading } = useSession();
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

	useEffect(() => {
		let isMounted = true;

		const launchGame = async () => {
			try {
				// Find game by name (handling spaces and dashes)
				// e.g. 'lagos-rush' matches 'Lagos Rush'
				const searchName = gameName.toLowerCase().replace(/-/g, " ");
				const targetGame = games.find(
					(g) =>
						g.name.toLowerCase() === searchName ||
						g.name.toLowerCase().includes(searchName),
				);

				if (!targetGame) {
					throw new Error(`Game "${searchName}" not found.`);
				}

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

		if (games.length > 0 && !gameUrl && !error) {
			launchGame();
		}

		return () => {
			isMounted = false;
		};
	}, [games, gameUrl, error, navigate, gameName]);

	const formattedGameName = gameName
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());

	if (isSessionLoading || isGamesLoading || (!gameUrl && !error)) {
		return (
			<div className="flex h-screen items-center justify-center dark:bg-[#121212]">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="h-10 w-10 animate-spin text-[#1BAA04]" />
					<p className="font-medium text-lg text-gray-900 dark:text-white">
						Loading {formattedGameName}...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-4 dark:bg-[#121212]">
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

	return (
		<div className="relative h-screen w-full bg-[#121212]">
			{isIframeLoading && (
				<div className="absolute inset-4 z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1BAA04]/50 bg-[#121212]/80 backdrop-blur-sm">
					<Loader2 className="mb-4 h-10 w-10 animate-spin text-[#1BAA04]" />
					<p className="font-medium text-lg text-white">
						{formattedGameName} is launching...
					</p>
					<p className="mt-2 text-gray-400 text-sm">
						Please wait while we set things up
					</p>
				</div>
			)}
			<iframe
				src={gameUrl!}
				className={cn(
					"h-screen w-full border-0 transition-opacity duration-500",
					isIframeLoading ? "opacity-0" : "opacity-100",
				)}
				title={formattedGameName}
				allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				onLoad={() => setIsIframeLoading(false)}
			/>
		</div>
	);
}
