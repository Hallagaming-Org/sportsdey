import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import Facebook from "@/logos/facebook.svg?react";
import Instagram from "@/logos/instagram.svg?react";
import Telegram from "@/logos/telegram.svg?react";
import X from "@/logos/x.svg?react";
import DiscordIcon from "@/logos/DiscordIcon";

export const socials = [
	{
		id: 1,
		icon: Facebook,
		link: "https://www.facebook.com/sportsdey247",
	},
	{
		id: 2,
		icon: X,
		link: "https://X.com/sportsdey247",
	},
	{
		id: 3,
		icon: Instagram,
		link: "https://Instagram.com/Sportsdey247",
	},
	{
		id: 4,
		icon: Telegram,
		link: "https://t.me/sportsdey2",
	},
	{
		id: 5,
		icon: DiscordIcon,
		link: "https://discord.com/invite/AKRc3K2v",
	},
];

const Socials = () => {
	const { theme, resolvedTheme } = useTheme();

	const widgetRef = useRef<HTMLDivElement | null>(null);


	const currentTheme = theme === "dark" || resolvedTheme === "dark" ? "dark" : "light";


	useEffect(() => {
		const SCRIPT_SRC = "https://www.livecoinwatch.com/static/lcw-widget.js";
		if (!widgetRef.current) return;

		// Add the widget container if it's not already present
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
		if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
			const s = document.createElement("script");
			s.src = SCRIPT_SRC;
			s.defer = true;
			document.body.appendChild(s);
		}
	}, [currentTheme]);

	useEffect(() => {
		const scriptId = "lcw-widget-script";
		if (!document.getElementById(scriptId)) {
			const script = document.createElement("script");
			script.id = scriptId;
			script.defer = true;
			script.src = "https://www.livecoinwatch.com/static/lcw-widget.js";
			document.body.appendChild(script);
		}
	}, []);

	return (
		<div className="flex w-full justify-center">
			<div className="relative block w-full overflow-hidden border border-[#F2EEFB]/10 bg-white dark:bg-[#04100B]">
				<div ref={widgetRef} className="flex w-full h-14" />
			</div>
		</div>
	);
}
	;

export default Socials;
