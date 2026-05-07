import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Footer from "@/components/footer";
import { Providers } from "@/components/providers";
import RegulatoryFooter from "@/components/RegulatoryFooter";
import Sidebar from "@/components/sidebar";
import Socials from "@/components/socials";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { store } from "@/store";
import Header from "../components/header";
import appCss from "../index.css?url";

import { RouterProviderComponents } from "@tanstack/react-router";

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
			.enum([SPORTS.FOOTBALL, SPORTS.TENNIS, SPORTS.BASKETBALL])
			.optional(),
	}),

	component: RootDocument,
});

function RootDocument() {
	const location = useLocation();
	const matches = useMatches();
	const activeRouteId = matches[matches.length - 1]?.routeId ?? "";
	const isAuthRoute = location.pathname.startsWith("/auth");
	const sidebarAllowedRouteIds = new Set([
		"/",
		"/index/$gameId",
		"/index/tournament/$tournamentId",
		"/basketball",
		"/basketball/",
		"/basketball/$Id",
		"/basketball/tournament/$tournamentId",
		"/tennis",
		"/tennis/",
		"/tennis/$Id",
		"/tennis/tournament/$tournamentId",
		"/news",
		"/news/",
		"/news/$slug",
		"/news/$slug/og",
		"/betting",
		"/games",
		"/game/$gameId",
	]);
	const shouldShowSidebar = sidebarAllowedRouteIds.has(activeRouteId);

	return (
		<Provider store={store}>
			<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
				<html lang="en" className="dark">
					<head>
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
										<div className="flex h-svh flex-col overflow-hidden">
											<header className="shrink-0">
												<Header />
											</header>

											<main className="no-scrollbar flex-1 overflow-y-auto">
												<Outlet />
											</main>
										</div>
									) : (
										<div className="flex h-svh flex-col overflow-hidden">
											<header className="shrink-0">
												<Header />
												<Socials />
											</header>

											<main className="no-scrollbar flex-1 overflow-y-auto">
												<div
													className={cn(
														"mx-4 grid py-4 md:gap-8 lg:mx-[104px]",
														shouldShowSidebar
															? "lg:grid-cols-[20%_80%]"
															: "lg:grid-cols-1",
													)}
												>
													{shouldShowSidebar && (
														<aside className="no-scrollbar hidden pr-4 lg:block lg:self-start lg:pb-6">
															<Sidebar />
														</aside>
													)}
													<section className="min-w-0">
														<Outlet />
													</section>
												</div>
												<RegulatoryFooter />
											</main>

											<footer className="shrink-0 lg:hidden">
												<Footer />
											</footer>
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
				<script
					id="tawk-script"
					key="tawk-script"
					dangerouslySetInnerHTML={{
						__html: `
window.addEventListener('load', function() {
var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/69a13f9e865cc31c343af2ac/1jieu113b';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();
});
`,
					}}
				/>
			</ThemeProvider>
		</Provider>
	);
}
