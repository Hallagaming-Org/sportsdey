import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	fetchScorpioLobbyGames,
	launchScorpioGame,
	type ScorpioLobbyGame,
} from "@/lib/scorpio-catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/$gameName")({
	component: PlayGamePage,
});

function PlayGamePage() {
	const { gameName } = Route.useParams();
	const navigate = useNavigate();
	const { data: session, isPending: isSessionLoading } = useSession();

	const [isPlayClicked, setIsPlayClicked] = useState(false);
	const [gameUrl, setGameUrl] = useState<string | null>(null);
	const [isIframeLoading, setIsIframeLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const { data: games = [], isLoading: isGamesLoading } = useQuery<
		ScorpioLobbyGame[]
	>({
		queryKey: ["scorpio-games"],
		queryFn: fetchScorpioLobbyGames,
		enabled: !!session?.user,
		staleTime: 60_000,
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
			g.code.toLowerCase() === searchCode ||
			g.code.toLowerCase() === decodedGameName.toLowerCase(),
	);

	useEffect(() => {
		let isMounted = true;

		const launchGame = async () => {
			if (!targetGame) {
				setError(`Game "${searchName}" not found.`);
				return;
			}

			try {
				const launch = await launchScorpioGame({
					providerId: targetGame.providerId,
					gameCode: targetGame.code,
					returnUrl: `${window.location.origin}/games`,
				});

				if (isMounted) {
					setGameUrl(launch.url);
					// Fallback to remove loader if iframe fails to trigger onLoad
					setTimeout(() => {
						if (isMounted) setIsIframeLoading(false);
					}, 5000);
				}
			} catch (err) {
				if (
					err instanceof ApiError &&
					(err.status === 401 || err.status === 403)
				) {
					if (isMounted) navigate({ to: "/auth/sign-in" });
					return;
				}
				if (isMounted) {
					setError(
						err instanceof Error ? err.message : "Something went wrong.",
					);
				}
			}
		};

		if (isPlayClicked && targetGame && !gameUrl && !error) {
			void launchGame();
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
				<p className="text-red-500 text-lg">
					Game "{formattedGameName}" not found.
				</p>
				<button
					type="button"
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
					type="button"
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
								<p className="text-xl font-bold text-white/50">
									{targetGame?.name}
								</p>
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
						{targetGame?.providerName && (
							<p className="mb-8 text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
								{targetGame.providerName}
								{targetGame.categories[0]
									? ` · ${targetGame.categories.find((c) => c.id.startsWith("type-"))?.name ?? targetGame.categories[0].name}`
									: ""}
							</p>
						)}

						<button
							type="button"
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
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2.5}
										d="M14 5l7 7m0 0l-7 7m7-7H3"
									/>
								</svg>
							</span>
						</button>
					</div>
				</div>
			</div>
		);
	}

	const router = useRouter();

	return (
		<div className="relative mt-4 flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#121212]">
			<div className="flex shrink-0 items-center px-4 py-3">
				<button
					type="button"
					onClick={() => router.history.back()}
					className="flex cursor-pointer items-center gap-2 font-medium text-white transition-colors hover:text-[#1BAA04]"
				>
					<ArrowLeft className="h-5 w-5" />
					<span>Back</span>
				</button>
			</div>
			<div className="relative w-full flex-1">
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
		</div>
	);
}
