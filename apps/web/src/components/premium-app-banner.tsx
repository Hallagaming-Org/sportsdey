import { ChevronRight, Gift, X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sportsdey-premium-app-banner-dismissed";

function appDownloadUrl(): string {
	if (typeof navigator === "undefined") {
		return "https://play.google.com/store/apps";
	}
	if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
		return "https://apps.apple.com";
	}
	return "https://play.google.com/store/apps";
}

export function PremiumAppBanner() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		try {
			if (window.localStorage.getItem(STORAGE_KEY) !== "1") {
				setVisible(true);
			}
		} catch {
			setVisible(true);
		}
	}, []);

	if (!visible) return null;

	const dismiss = () => {
		setVisible(false);
		try {
			window.localStorage.setItem(STORAGE_KEY, "1");
		} catch {
			// ignore
		}
	};

	return (
		<div className="w-full bg-accent text-white">
			<div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 lg:h-10 lg:justify-between lg:px-8 lg:py-0">
				<div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
					<Gift
						className="h-8 w-8 shrink-0 lg:h-5 lg:w-5"
						strokeWidth={1.75}
						aria-hidden
					/>
					<p className="min-w-0 font-semibold text-[13px] leading-snug sm:text-sm lg:whitespace-nowrap lg:text-[13px]">
						Want to Enjoy more premium features
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2 sm:gap-3">
					<a
						href={appDownloadUrl()}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 py-1.5 font-semibold text-[#040C01] text-[11px] sm:px-4 sm:text-xs lg:px-3.5 lg:py-1 lg:text-[11px]"
					>
						Download App Now
						<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
					</a>
					<button
						type="button"
						onClick={dismiss}
						className="flex h-8 w-8 items-center justify-center text-white lg:h-6 lg:w-6"
						aria-label="Dismiss app download banner"
					>
						<X className="h-4 w-4" strokeWidth={2.5} />
					</button>
				</div>
			</div>
		</div>
	);
}
