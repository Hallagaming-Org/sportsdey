import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import { getBanners } from "@/lib/banners-server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/betting")({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			type: search.type as string | undefined,
		};
	},
	loader: () => getBanners(),
	component: RouteComponent,
});

function RouteComponent() {
	const [isIframeLoading, setIsIframeLoading] = useState(true);
	const [theme, setTheme] = useState("sportsdeyLite");
	const { type = "jackpots" } = useSearch({ from: "/betting" });
	const banners = Route.useLoaderData() || [];
	useEffect(() => {
		// Detect initial theme
		const isDarkMode = document.documentElement.classList.contains("dark");
		setTheme(isDarkMode ? "sportsdeyDark" : "sportsdeyLite");

		// Watch for theme changes
		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "sportsdeyDark" : "sportsdeyLite");
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		// Trigger loading state when type changes so opacity transition runs
		setIsIframeLoading(true);
		const timeout = setTimeout(() => setIsIframeLoading(false), 5000);
		return () => clearTimeout(timeout);
	}, [type, theme]);

	useEffect(() => {
		const timer = setTimeout(() => setIsIframeLoading(false), 5000);
		const handleMessage = (event: MessageEvent) => {
			if (event.origin !== "https://bet.sportsdey.com") return;

			if (event.data?.type === "SET_LOBBY_WIDGET_HEIGHT") {
				const iframe = document.getElementById(
					"bettingWidget"
				) as HTMLIFrameElement | null;

				if (iframe && event.data.height) {
					iframe.style.height = `${event.data.height}px`;
				}
			}
		}

		window.addEventListener("message", handleMessage);

		return () => {
			window.removeEventListener("message", handleMessage);
			clearTimeout(timer);
		};
	}, []);

	return (
		<div className="my-5 space-y-4">
			{banners.length > 0 && <BannerCarousel banners={banners} />}
			{isIframeLoading && (
				<div className="absolute inset-0 flex items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			)}
			<iframe
				id="bettingWidget"
				title="lobby widget"
				src={`https://bet.sportsdey.com/?view=fullPage&theme=${theme}&ticketOpenMode=embedded&type=${encodeURIComponent(
					type,
				)}`}
				className={cn(
					"rounded-2xl transition-opacity duration-500",
					isIframeLoading ? "opacity-0" : "opacity-100",
				)}
				style={{
					width: "100%",
					minHeight: "calc(60vh - 250px)",
					border: "0",
					overflow: "hidden",
				}}
			/>
		</div>
	);
}
