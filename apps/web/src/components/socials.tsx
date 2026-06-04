import { useEffect } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
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
	}
];


const Socials = () => {
	const { theme, resolvedTheme } = useTheme();

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

	const currentTheme = theme === "dark" || resolvedTheme === "dark" ? "dark" : "light";

	return (
		<div className="my-4 hidden w-full px-8 md:px-0 lg:flex lg:justify-center">
			<div
				className={cn(
					"relative mt-4 flex w-full items-center overflow-hidden gap-x-6 border border-[#F2EEFB]/10",
					currentTheme === "dark" ? "bg-[#04100B]" : "bg-white"
				)}
			>
				<div
					className="livecoinwatch-widget-5"
					{...{
						"lcw-base": "USDT",
						"lcw-color-tx": "#999999",
						"lcw-marquee-1": "coins",
						"lcw-marquee-2": "none",
						"lcw-marquee-items": "20",
					}}
				></div>
			</div>
		</div>
	);
};

export default Socials;
