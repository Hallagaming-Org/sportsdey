import { useEffect, useRef } from "react";
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
		link: "https://www.tiktok.com/@sportsdey247",
	}
];
const Socials = () => {
	const widgetRef = useRef<HTMLDivElement | null>(null);

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

		// Inject the script once
		if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
			const s = document.createElement("script");
			s.src = SCRIPT_SRC;
			s.defer = true;
			document.body.appendChild(s);
		}
	}, []);

	return (
		<div className="my-4 hidden w-full px-8 md:px-0 lg:flex">
			<div ref={widgetRef} className="mt-4 flex w-full  bg-white h-14" />
		</div>
	);
};

export default Socials;
