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

export const Route = createFileRoute("/aviator")({
	component: AviatorPage,
});

function AviatorPage() {
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

		const launchAviator = async () => {
			try {
				const aviatorGame = games.find((g) =>
					g.name.toLowerCase().includes("aviator"),
				);

				if (!aviatorGame) {
					throw new Error("Aviator game not found.");
				}

				const url = `${import.meta.env.VITE_SERVER_URL}slotegrator/launch`;
				const body = { game_uuid: aviatorGame.code };

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
			launchAviator();
		}

		return () => {
			isMounted = false;
		};
	}, [games, gameUrl, error, navigate]);

	if (isSessionLoading || isGamesLoading || (!gameUrl && !error)) {
		return (
			<div className="flex h-screen items-center justify-center dark:bg-[#121212]">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="h-10 w-10 animate-spin text-[#1BAA04]" />
					<p className="font-medium text-lg text-gray-900 dark:text-white">
						Loading Aviator...
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
					<p className="font-medium text-lg text-white">Aviator is launching...</p>
					<p className="mt-2 text-gray-400 text-sm">Please wait while we set things up</p>
				</div>
			)}
			<iframe
				src={gameUrl!}
				className={cn(
					"h-screen w-full border-0 transition-opacity duration-500",
					isIframeLoading ? "opacity-0" : "opacity-100",
				)}
				title="Aviator"
				allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				onLoad={() => setIsIframeLoading(false)}
			/>
		</div>
	);
}
