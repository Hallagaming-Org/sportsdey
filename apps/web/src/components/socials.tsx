import { useEffect, useRef } from "react";
import DiscordIcon from "@/logos/DiscordIcon";
import Facebook from "@/logos/facebook.svg?react";
import Instagram from "@/logos/instagram.svg?react";
import Telegram from "@/logos/telegram.svg?react";
import X from "@/logos/x.svg?react";

export const socials = [
	{
		id: 1,
		icon: Facebook,
		link: "https://www.facebook.com/sportsdey247",
		label: "Facebook",
	},
	{
		id: 2,
		icon: X,
		link: "https://X.com/sportsdey247",
		label: "X",
	},
	{
		id: 3,
		icon: Instagram,
		link: "https://Instagram.com/Sportsdey247",
		label: "Instagram",
	},
	{
		id: 4,
		icon: Telegram,
		link: "https://t.me/sportsdey2",
		label: "Telegram",
	},
	{
		id: 5,
		icon: DiscordIcon,
		link: "https://discord.com/invite/AKRc3K2v",
		label: "Discord",
	},
];

const Socials = () => {
	const widgetRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const SCRIPT_SRC = "https://www.livecoinwatch.com/static/lcw-widget.js";
		const scriptId = "lcw-widget-script";
		if (!widgetRef.current) return;

		const mount = () => {
			if (!widgetRef.current) return;
			if (!widgetRef.current.querySelector(".livecoinwatch-widget-5")) {
				const w = document.createElement("div");
				w.className = "livecoinwatch-widget-5";
				w.setAttribute("lcw-base", "USD");
				w.setAttribute("lcw-color-tx", "#999999");
				w.setAttribute("lcw-marquee-1", "coins");
				w.setAttribute("lcw-marquee-2", "none");
				w.setAttribute("lcw-marquee-items", "10");
				widgetRef.current.appendChild(w);
			}
			if (!document.getElementById(scriptId)) {
				const script = document.createElement("script");
				script.id = scriptId;
				script.defer = true;
				script.async = true;
				script.src = SCRIPT_SRC;
				document.body.appendChild(script);
			}
		};

		if ("requestIdleCallback" in window) {
			const idleId = window.requestIdleCallback(mount, { timeout: 4000 });
			return () => window.cancelIdleCallback(idleId);
		}
		const timeoutId = window.setTimeout(mount, 2000);
		return () => window.clearTimeout(timeoutId);
	}, []);

	return (
		<div className="flex h-14 min-h-14 w-full justify-center">
			<div className="relative block h-14 min-h-14 w-full overflow-hidden border border-[#F2EEFB]/10 bg-white dark:bg-[#04100B]">
				<div ref={widgetRef} className="flex h-14 min-h-14 w-full" />
			</div>
		</div>
	);
};

export default Socials;
