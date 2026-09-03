import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SportsbookBetslip } from "@/components/sportsbook-betslip";
import { Button } from "@/components/ui/button";
import { ensureAccumulatorBoostsSynced } from "@/lib/accumulator-sync";
import { ApiError, apiRequest } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth/client";
import {
	buildAppInitOptions,
	dispatchBettingInit,
	getSportsbookBootstrapScript,
	isSportsbookConfigured,
	loadSportsbookBootstrapScript,
	SPORTSBOOK_CONTAINER_ID,
} from "@/lib/sportsbook";

export const Route = createFileRoute("/sportsbetting/$")({
	validateSearch: (search: Record<string, unknown>) => ({
		sportTypeSlug:
			typeof search.sportTypeSlug === "string"
				? search.sportTypeSlug
				: undefined,
		sportEventStatusSlug:
			typeof search.sportEventStatusSlug === "string"
				? search.sportEventStatusSlug
				: undefined,
	}),
	component: SportsbookPage,
});

type SportsbookTokenResponse = {
	token: string;
};

export function SportsbookPage() {
	const { data: session, isPending: isSessionLoading } = useSession();
	const [isDarkTheme, setIsDarkTheme] = useState(false);
	const [token, setToken] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const initializedTokenRef = useRef<string | null>(null);
	const previousThemeRef = useRef<boolean | null>(null);
	const navigate = useNavigate();

	useEffect(() => {
		const isDarkMode = document.documentElement.classList.contains("dark");
		setIsDarkTheme(isDarkMode);

		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains("dark");
			setIsDarkTheme(isDark);
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (previousThemeRef.current === null) {
			previousThemeRef.current = isDarkTheme;
			return;
		}
		if (
			previousThemeRef.current !== isDarkTheme &&
			initializedTokenRef.current
		) {
			window.location.reload();
		}
		previousThemeRef.current = isDarkTheme;
	}, [isDarkTheme]);

	const loadToken = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		initializedTokenRef.current = null;
		try {
			const data = await apiRequest<SportsbookTokenResponse>(
				"sportsbook/token/create",
				{
					method: "POST",
					credentials: "include",
				},
			);
			setToken(data.token);
		} catch (err) {
			if (err instanceof ApiError) {
				setError(err.message);
			} else {
				setError("Failed to create sportsbook session. Please try again.");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	const accumulatorSyncUserRef = useRef<string | null>(null);

	useEffect(() => {
		if (!token || !session?.user) {
			return;
		}
		if (accumulatorSyncUserRef.current === session.user.id) {
			return;
		}
		accumulatorSyncUserRef.current = session.user.id;

		void ensureAccumulatorBoostsSynced().catch((err) => {
			console.warn("Accumulator boost sync failed on sportsbook load", err);
		});
	}, [token, session?.user]);

	useEffect(() => {
		// if (isSessionLoading || !session?.user) return;
		void loadToken();
	}, [isSessionLoading, session?.user, loadToken]);

	useEffect(() => {
		if (!token || !isSportsbookConfigured()) {
			return;
		}

		if (initializedTokenRef.current === token) {
			return;
		}

		let cancelled = false;

		const initSportsbook = async () => {
			try {
				await loadSportsbookBootstrapScript(getSportsbookBootstrapScript());
				if (cancelled || !window.bettingLoader) {
					return;
				}

				window.bettingLoader.load(
					buildAppInitOptions(token, isDarkTheme),
					(bettingAPI) => {
						dispatchBettingInit(bettingAPI);
						bettingAPI.subscribe("redirect", ({ destination, link }) => {
							switch (destination) {
								case "login": {
									navigate({ 
										to: "/auth/sign-in",
										search: { returnTo: window.location.pathname + window.location.search }
									});
									break;
								}
								case "logout": {
									signOut().then(() => {
										navigate({ to: "/auth/sign-in" });
									});
									break;
								}
								case "betting-page": {
									const cleanLink = link && link.startsWith("/") ? link.slice(1) : (link ?? "");
									navigate({
										to: "/sportsbetting/$",
										params: { _splat: cleanLink },
									});
									window.scrollTo({ top: 0, behavior: "smooth" });
									const mains = document.querySelectorAll("main");
									mains.forEach((main) => {
										main.scrollTo({ top: 0, behavior: "smooth" });
									});
									break;
								}
								default: {
									break;
								}
							}
						});
					},
				);
				initializedTokenRef.current = token;
			} catch {
				if (!cancelled) {
					setError("Failed to load sportsbook application.");
				}
			}
		};

		void initSportsbook();

		return () => {
			cancelled = true;
		};
	}, [token, isDarkTheme]);

	// if (!isSessionLoading && !session?.user) {
	//  return <Navigate to="/auth/sign-in" />;
	// }

	if (!isSportsbookConfigured()) {
		return (
			<div className="my-5 rounded-2xl bg-white p-6 dark:bg-[#202120]">
				<p className="font-semibold text-lg">Sportsbook setup is incomplete.</p>
				<p className="mt-2 text-sm">
					Set `VITE_DATABET_SPA_BOOTSTRAP_SCRIPT` and
					`VITE_DATABET_SPA_BASENAME`.
				</p>
			</div>
		);
	}

	return (
		<div className="relative my-2 space-y-4">
			<div id={SPORTSBOOK_CONTAINER_ID} className="min-h-[calc(100vh-200px)]" />
			<SportsbookBetslip />

			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-[#202120]/80">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			)}

			{!isLoading && error && (
				<div className="absolute inset-0 flex items-center justify-center p-6">
					<div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-[#202120]">
						<p className="font-semibold text-lg">Unable to load sportsbook.</p>
						<p className="mt-2 text-sm">{error}</p>
						<Button
							className="mt-4"
							type="button"
							onClick={() => void loadToken()}
						>
							Retry
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
