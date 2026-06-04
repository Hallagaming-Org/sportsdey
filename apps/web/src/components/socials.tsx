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
		const scriptId = "tv-ticker-tape-script";
		if (!document.getElementById(scriptId)) {
			const script = document.createElement("script");
			script.id = scriptId;
			script.type = "module";
			script.src = "https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js";
			script.async = true;
			document.body.appendChild(script);
		}
	}, []);

	const currentTheme = theme === "dark" || resolvedTheme === "dark" ? "dark" : "light";

	return (
		<div className="my-4 hidden w-full px-8 md:px-0 lg:flex lg:justify-center">
			<div
				className={cn(
					"relative mt-4 flex w-full items-center overflow-hidden border border-[#F2EEFB]/10",
					currentTheme === "dark" ? "bg-[#04100B]" : "bg-white"
				)}
			>
				{/* Left fade overlay */}
				{/* <div
					className={cn(
						"pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r to-transparent",
						currentTheme === "dark" ? "from-[#04100B]" : "from-white"
					)}
				/> */}

				{/* Right fade overlay */}
				{/* <div
					className={cn(
						"pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l to-transparent",
						currentTheme === "dark" ? "from-[#04100B]" : "from-white"
					)}
				/> */}

				<tv-ticker-tape
					symbols="BINANCE:BTCUSDT,BINANCE:ETHUSDT,BINANCE:SOLUSDT,BINANCE:XRPUSDT,BINANCE:BNBUSDT,BINANCE:SUIUSDT,KUCOIN:HYPEUSDT,BINANCE:ZECUSDT,BINANCE:DOGEUSDT,BINANCE:NEARUSDT,BINANCE:AVAXUSDT,BINANCE:LINKUSDT,BINANCE:ADAUSDT,BINANCE:ZECUSDT"
					item-size="compact"
					transparent="true"
					color-theme={currentTheme}
				></tv-ticker-tape>
			</div>
		</div>
	);
};

export default Socials;
