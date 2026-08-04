import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useLocation,
	useMatches,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Provider } from "react-redux";
import z from "zod";
import DesktopFooter from "@/components/desktop-footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Footer from "@/components/footer";
import { Providers } from "@/components/providers";
import Sidebar from "@/components/sidebar";
import Socials from "@/components/socials";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { useSession } from "@/lib/auth/client";
import { SPORTS } from "@/lib/constants";

import { cn } from "@/lib/utils";
import { store } from "@/store";
import Header from "../components/header";
import appCss from "../index.css?url";

// import { RouterProviderComponents } from "@tanstack/react-router";

export type RouterAppContext = {
	historyState?: {
		gameUrl?: string;
	};
};

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 10 * 1000,
			gcTime: 5 * 10 * 1000,
		},
	},
});

export const Route = createRootRouteWithContext<RouterAppContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "description",
				content:
					"Get Live Football & Basketball Scores plus News, and Real-Time Results with Sportsdey! Everything Sports Dey here! Click now!",
			},
			{
				title: "sportsdey",
			},
		],
	}),
	validateSearch: z.object({
		sports: z
			.enum([
				SPORTS.FOOTBALL,
				SPORTS.TENNIS,
				SPORTS.BASKETBALL,
				SPORTS.BOXING,
				SPORTS.UFC,
			])
			.optional(),
	}),

	component: RootDocument,
});

function RootDocument() {
	const location = useLocation();
	const matches = useMatches();
	const { data: session } = useSession();

	useEffect(() => {
		window.scrollTo(0, 0);
		const mains = document.querySelectorAll("main");
		mains.forEach((main) => {
			main.scrollTo(0, 0);
		});
	}, [location.pathname]);

	const activeRouteId = matches[matches.length - 1]?.routeId ?? "";
	const isAuthRoute = location.pathname.startsWith("/auth");
	const isGameRoute = location.pathname.startsWith("/game/") || location.pathname.startsWith("/play/");
	const sidebarAllowedRouteIds = new Set([
		"/",
		"/index/$gameId",
		"/index/matches",
		"/index/tournament/$tournamentId",
		"/basketball",
		"/basketball/",
		"/basketball/$Id",
		"/basketball/matches",
		"/basketball/tournament/$tournamentId",
		"/tennis",
		"/tennis/",
		"/tennis/$Id",
		"/tennis/matches",
		"/tennis/tournament/$tournamentId",
		"/boxing",
		"/boxing/",
		"/ufc",
		"/ufc/",
		"/news",
		"/news/",
		"/news/$slug",
		"/news/$slug/og",
		"/videos",
		"/videos/",
		"/betting",
		"/sportsbetting",
		"/sportsbetting/$",
		"/games",
		"/game/$gameId",
		"/play/$gameName",
		"/wallet",
		"/account",
		"/favorites",
		"/faqs",
		"/about",
		"/privacy-policy",
		"/terms",
		"/general-betting-rules",
		"/kyc",
		"/kyc/",
		"/kyc/verify",
		"/promotions",
		"/promotions/",
		"/promotions/$id",
		"/missions",
		"/missions/",
		"/bet-history",
	]);
	const shouldShowSidebar = sidebarAllowedRouteIds.has(activeRouteId);

	return (
		<Provider store={store}>
			<ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
				<html lang="en" className="dark">
					<head>
						<script
							id="name-polyfill"
							key="name-polyfill"
							dangerouslySetInnerHTML={{
								__html: `if (typeof window !== "undefined") { window.__name = function(func, value) { return Object.defineProperty(func, "name", { value: value, configurable: true }); }; }`,
							}}
						/>
						<script
							id="gtm-script"
							key="gtm-script"
							dangerouslySetInnerHTML={{
								__html: `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-5JZSLR3K');
      `,
							}}
						/>
						<script
							id="_webengage_script_tag"
							key="webengage-script"
							dangerouslySetInnerHTML={{
								__html: `
var webengage;!function(w,e,b,n,g){function o(e,t){e[t[t.length-1]]=function(){r.__queue.push([t.join("."),
arguments])}}var i,s,r=w[b],z=" ",l="init options track screen onReady".split(z),a="webPersonalization feedback survey notification notificationInbox".split(z),c="options render clear abort".split(z),p="Prepare Render Open Close Submit Complete View Click".split(z),u="identify login logout setAttribute".split(z);if(!r||!r.__v){for(w[b]=r={__queue:[],__v:"6.0",user:{}},i=0;i < l.length;i++)o(r,[l[i]]);for(i=0;i < a.length;i++){for(r[a[i]]={},s=0;s < c.length;s++)o(r[a[i]],[a[i],c[s]]);for(s=0;s < p.length;s++)o(r[a[i]],[a[i],"on"+p[s]])}for(i=0;i < u.length;i++)o(r.user,["user",u[i]]);setTimeout(function(){var f=e.createElement("script"),d=e.getElementById("_webengage_script_tag");f.type="text/javascript",f.async=!0,f.src=("https:"==e.location.protocol?"https://widgets.ksa.webengage.com":"http://widgets.ksa.webengage.com")+"/js/webengage-min-v-6.0.js",d.parentNode.insertBefore(f,d)})}}(window,document,"webengage");webengage.init("ksa~aa13187c");
`,
							}}
						/>

						<HeadContent />
						<link rel="icon" href="/Favicon.svg" type="image/svg+xml" />
						<link rel="stylesheet" href={appCss} />
					</head>
					<body suppressHydrationWarning>
						<noscript>
							<iframe
								src="https://www.googletagmanager.com/ns.html?id=GTM-5JZSLR3K"
								height="0"
								width="0"
								style={{ display: "none", visibility: "hidden" }}
								title="Google Tag Manager"
							/>
						</noscript>
						<QueryClientProvider client={queryClient}>
							<ErrorBoundary>
								<Providers>
									{isAuthRoute ? (
										<div className="flex h-svh flex-col overflow-clip">
											<header className="shrink-0">
												<Header />
											</header>

											<main className="no-scrollbar flex-1 overflow-y-auto">
												<Outlet />
											</main>
										</div>
									) : (
										<div className="flex h-svh flex-col overflow-clip">
											<header className="shrink-0">
												<Header />
												{!isGameRoute && <Socials />}
											</header>

											<main className={cn("no-scrollbar flex-1 overflow-y-auto", isGameRoute && "flex flex-col")}>
												<div
													className={cn(
														isGameRoute ? "" : "mx-4 grid py-4 md:gap-8 lg:mx-[104px]",
														!isGameRoute && shouldShowSidebar
															? "lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[20%_80%]"
															: (!isGameRoute ? "lg:grid-cols-1" : ""),
														isGameRoute && "h-full flex-1"
													)}
												>
													{!isGameRoute && shouldShowSidebar && (
														<aside className="no-scrollbar hidden pr-4 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pb-6">
															<Sidebar />
														</aside>
													)}
													<section className={cn("min-w-0", isGameRoute && "h-full flex-1")}>
														<Outlet />
													</section>
												</div>
												{/* {!isSportsbookRoute && (
													<div className="mx-4 lg:mx-[104px] mb-8">
														<AppDownloadBanner />
													</div>
												)} */}
												{!isGameRoute && <DesktopFooter />}
											</main>

											{!isGameRoute && (
												<footer className="shrink-0 lg:hidden">
													<Footer />
												</footer>
											)}
										</div>
									)}
								</Providers>

								<Toaster richColors position="top-right" />
								<TanStackRouterDevtools position="bottom-right" />
								<ReactQueryDevtools initialIsOpen={false} />
								<Scripts />
							</ErrorBoundary>
						</QueryClientProvider>
					</body>
				</html>
			</ThemeProvider>
		</Provider>
	);
}
