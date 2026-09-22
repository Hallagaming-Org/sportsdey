import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SportsbookBetslip } from "@/components/sportsbook-betslip";
import { SportsbookSkeleton } from "@/components/sportsbook-skeleton";
import { Button } from "@/components/ui/button";
import { ensureAccumulatorBoostsSynced } from "@/lib/accumulator-sync";
import { ApiError, apiRequest } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth/client";
import {
	buildAppInitOptions,
	dispatchBettingInit,
	getSportsbookBootstrapScript,
	isSportsbookConfigured,
	installSportsbookHostChromeFix,
	loadSportsbookBootstrapScript,
	patchDatabetLayoutForHostChrome,
	SPORTSBOOK_CONTAINER_ID,
	SPORTSBOOK_PREMATCH_SPLAT,
} from "@/lib/sportsbook";

export const Route = createFileRoute("/sportsbetting/$")({
	beforeLoad: ({ params }) => {
		if (!params._splat) {
			throw redirect({
				to: "/sportsbetting/$",
				params: { _splat: SPORTSBOOK_PREMATCH_SPLAT },
				search: {},
				replace: true,
			});
		}
	},
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
	const [isSportsbookPainted, setIsSportsbookPainted] = useState(false);
	const initializedTokenRef = useRef<string | null>(null);
	const previousThemeRef = useRef<boolean | null>(null);
	const tokenRequestIdRef = useRef(0);
	const accumulatorSyncUserRef = useRef<string | null>(null);
	const navigate = useNavigate();

	useEffect(() => {
		if (!isSportsbookConfigured()) return;
		void loadSportsbookBootstrapScript(getSportsbookBootstrapScript()).catch(
			() => {
				// Token init reports load failures once bettingLoader.load runs.
			},
		);
	}, []);

	useEffect(() => {
		const host = document.getElementById(SPORTSBOOK_CONTAINER_ID);
		if (!host) return;

		const markPainted = () => {
			const root = host.shadowRoot;
			if (root && root.childElementCount > 0) {
				setIsSportsbookPainted(true);
				return true;
			}
			return false;
		};

		if (markPainted()) return;
		const observer = new MutationObserver(() => {
			if (markPainted()) observer.disconnect();
		});
		observer.observe(host, { childList: true, subtree: true });
		const timeoutId = window.setTimeout(() => {
			if (host.childElementCount > 0 || host.shadowRoot) {
				setIsSportsbookPainted(true);
			}
		}, 8000);
		return () => {
			observer.disconnect();
			window.clearTimeout(timeoutId);
		};
	}, []);

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

	const loadToken = useCallback(async (options?: { silent?: boolean }) => {
		const requestId = ++tokenRequestIdRef.current;
		if (!options?.silent) {
			setIsLoading(true);
			setError(null);
		}
		initializedTokenRef.current = null;
		try {
			const data = await apiRequest<SportsbookTokenResponse>(
				"sportsbook/token/create",
				{
					method: "POST",
					credentials: "include",
				},
			);
			if (requestId !== tokenRequestIdRef.current) {
				return;
			}
			setToken(data.token);
		} catch (err) {
			if (requestId !== tokenRequestIdRef.current) {
				return;
			}
			if (err instanceof ApiError) {
				setError(err.message);
			} else {
				setError("Failed to create sportsbook session. Please try again.");
			}
		} finally {
			if (requestId === tokenRequestIdRef.current && !options?.silent) {
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		if (isSessionLoading || !session?.user) {
			return;
		}
		if (accumulatorSyncUserRef.current === session.user.id) {
			return;
		}
		accumulatorSyncUserRef.current = session.user.id;

		const run = () => {
			void ensureAccumulatorBoostsSynced()
				.then((status) => {
					if (status === "synced") {
						return loadToken({ silent: true });
					}
				})
				.catch(() => {
					// Boost sync is best-effort; the lobby still loads.
				});
		};
		if ("requestIdleCallback" in window) {
			const idleId = window.requestIdleCallback(run, { timeout: 5000 });
			return () => window.cancelIdleCallback(idleId);
		}
		const timeoutId = window.setTimeout(run, 1500);
		return () => window.clearTimeout(timeoutId);
	}, [isSessionLoading, session?.user, loadToken]);

	useEffect(() => {
		const host = document.getElementById(SPORTSBOOK_CONTAINER_ID);
		if (!host) return;
		return installSportsbookHostChromeFix(host);
	}, []);

	useEffect(() => {
		const { pathname, search } = window.location;
		if (!/%3A/i.test(pathname)) return;
		try {
			const decoded = decodeURIComponent(pathname);
			if (decoded !== pathname) {
				window.history.replaceState(null, "", `${decoded}${search}`);
			}
		} catch {
			// keep the encoded path if it is not valid URI encoding
		}
	}, []);

	useEffect(() => {
		if (isSessionLoading) {
			return;
		}
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

				patchDatabetLayoutForHostChrome();
				window.bettingLoader.load(
					buildAppInitOptions(token, isDarkTheme),
					(bettingAPI) => {
						if (cancelled) {
							return;
						}
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
				if (!cancelled) {
					initializedTokenRef.current = token;
				}
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
		<div className="relative min-h-[calc(100dvh-12.5rem)] min-w-0 max-w-full overflow-x-clip bg-transparent p-0">
			<div
				id={SPORTSBOOK_CONTAINER_ID}
				className="relative min-h-[calc(100dvh-12.5rem)] min-w-0 w-full max-w-full bg-transparent p-0 [contain:layout]"
			/>
			<SportsbookBetslip />

			{(!isSportsbookPainted || isLoading) && !error && <SportsbookSkeleton />}

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
