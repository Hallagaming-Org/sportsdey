import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function BettingWidget() {
	const [isIframeLoading, setIsIframeLoading] = useState(true);
	const theme = "sportsdeyDark";

	useEffect(() => {
		const timer = setTimeout(() => setIsIframeLoading(false), 5000);
		const handleMessage = (event: MessageEvent) => {
			if (event.origin !== "https://bet.sportsdey.com") return;

			if (event.data?.type === "SET_LOBBY_SIDEBAR_WIDGET_HEIGHT") {
				const iframe = document.getElementById(
					"lobbySidebarWidget",
				) as HTMLIFrameElement | null;

				if (iframe && event.data.height) {
					iframe.style.height = `${event.data.height}px`;
				}
			}
		};

		window.addEventListener("message", handleMessage);

		return () => {
			window.removeEventListener("message", handleMessage);
			clearTimeout(timer);
		};
	}, []);

	return (
		<div className="overflow-hidden rounded-2xl bg-white dark:bg-[#202120]">
			<hr className="dark:border-[#5A5F63]" />
			<div className="relative">
				{isIframeLoading && (
					<div className="absolute inset-0 flex items-center justify-center py-10">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				)}
				<iframe
					id="lobbySidebarWidget"
					src={`https://bet.sportsdey.com/?view=sidebar&theme=${theme}&ticketOpenMode=redirect`}
					title="sportsdey betting widget"
					className={cn(
						"transition-opacity duration-500",
						isIframeLoading ? "opacity-0" : "opacity-100",
					)}
					style={{
						width: "100%",
						minHeight: "200px",
						border: "0",
						overflow: "hidden",
					}}
				/>
			</div>
			<ul className="px-6 pb-6 dark:border-[#5A5F63]">
				<li>
					<a
						href="https://www.youtube.com/playlist?list=PLfYN70E9S81O0_bio6u3c9rc-mhBlbdBn"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-3 transition-colors hover:text-accent"
					>
						<img
							src="/betting-logo.png"
							className="h-5 w-5 object-contain"
							alt="Betting"
						/>
						<span className="font-medium text-sm">Tutorial</span>
					</a>
				</li>
			</ul>
		</div>
	);
}
