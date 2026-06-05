import { Link } from "@tanstack/react-router";
import { useCurrentSport } from "@/hooks/use-current-sport";
import Whatsapp from "@/logos/Whatsapp";
import NewSportsdeyLogo from "@/logos/NewSportsdeyLogo.svg?react";
import { Apple, GooglePlay } from "iconsax-reactjs";
import FacebookFooterIcon from "@/logos/FacebookFooterIcon";
import XFooter from "@/logos/XFooter";
import InstagramFooter from "@/logos/InstagramFooter";
import TelegramFooter from "@/logos/TelegramFooter";
import DiscordFooter from "@/logos/DiscordFooter";

const footerSocials = [
	{ icon: FacebookFooterIcon, label: "Facebook", link: "https://facebook.com/sportsdey247" },
	{ icon: XFooter, label: "Twitter/X", link: "https://X.com/sportsdey247" },
	{ icon: InstagramFooter, label: "Instagram", link: "https://Instagram.com/Sportsdey247" },
	{ icon: TelegramFooter, label: "Telegram", link: "https://t.me/sportsdey2" },
	{ icon: Whatsapp, label: "WhatsApp", link: "https://t.me/sportsdey2" },
	{ icon: DiscordFooter, label: "Discord", link: "https://discord.gg/AKRc3K2v" },
];

export default function DesktopFooter() {
	const currentSport = useCurrentSport();

	return (
		<footer className="w-full border-t border-[#1B2722] bg-[#000606] px-6 py-12 text-white transition-colors">
			<div className="mx-auto mb-12 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-5">
				<div className="space-y-4 md:col-span-2">
					<div className="flex items-center gap-3">
						<img
							src="/sportsdey-logo.png"
							className="h-8 hidden dark:block"
							alt="SportsDey Logo"
						/>
						<NewSportsdeyLogo className="h-8 w-auto dark:hidden text-white" />
						<div className="flex h-6 items-center rounded-full bg-[#1A1A1A] px-3 text-[10px] font-medium text-gray-300">
							EN <span className="ml-1 text-[8px]">▼</span>
						</div>
					</div>
					<p className="max-w-xs text-sm leading-relaxed text-[#A0A0A0]">
						Your #1 Sports Hub for News, Scores, Tips & More.
					</p>

					<div className="mt-6 flex items-start gap-3">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-600 text-[10px] font-bold text-red-600">
							18+
						</div>
						<p className="max-w-[250px] text-xs leading-relaxed text-[#A0A0A0]">
							All Players must be 18 or older to register or play. Please Gamble responsibly
						</p>
					</div>
				</div>

				<div>
					<h3 className="mb-6 font-bold text-base text-white">Quick Links</h3>
					<ul className="space-y-4 text-sm">
						<li>
							<Link
								to="/"
								search={{ sports: currentSport, league: undefined }}
								className="text-[#A0A0A0] transition-colors hover:text-white"
							>
								Matches
							</Link>
						</li>
						<li>
							<Link
								to="/news"
								search={{ sports: currentSport, tab: "news" }}
								className="text-[#A0A0A0] transition-colors hover:text-white"
							>
								News
							</Link>
						</li>
						<li>
							<Link
								to="/betting"
								search={{ type: undefined }}
								className="text-[#A0A0A0] transition-colors hover:text-white"
							>
								Tips
							</Link>
						</li>
						<li>
							<Link
								to="/news"
								search={{ sports: currentSport, tab: "videos" }}
								className="text-[#A0A0A0] transition-colors hover:text-white"
							>
								Videos
							</Link>
						</li>
					</ul>
				</div>

				<div>
					<h3 className="mb-6 font-bold text-base text-white">Our Engagements</h3>
					<ul className="space-y-4 text-sm">
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">Prediction Market</span></li>
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">FAQs</span></li>
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">Esports Tournament</span></li>
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">Jackpots</span></li>
					</ul>
				</div>

				<div>
					<h3 className="mb-6 font-bold text-base text-white">About SportsDey</h3>
					<ul className="space-y-4 text-sm mb-8">
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">About Us</span></li>
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">Contact Us</span></li>
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">Terms and Conditions</span></li>
						<li><span className="text-[#A0A0A0] transition-colors hover:text-white cursor-pointer">Privacy Policy</span></li>
					</ul>

					<div className="flex flex-row items-center gap-3">
						<button className="flex w-[150px] items-center gap-3 rounded-xl border border-gray-700 bg-[#041107] px-3 py-2 transition-colors hover:bg-white/5 cursor-pointer">
							<Apple
								size={20}
								color="white"
								variant="Bold"
							/>
							<div className="flex flex-col items-start">
								<span className="text-[9px] leading-tight text-gray-400">Download on</span>
								<span className="text-sm font-semibold leading-tight text-white">App store</span>
							</div>
						</button>
						<button className="flex w-[150px] items-center gap-3 rounded-xl border border-gray-700 bg-[#041107] px-3 py-2 transition-colors hover:bg-white/5 cursor-pointer">
							<GooglePlay
								size={20}
								color="white"
								variant="Bold"
							/>
							<div className="flex flex-col items-start">
								<span className="text-[9px] leading-tight text-gray-400">Get it on</span>
								<span className="text-sm font-semibold leading-tight text-white">Google Play</span>
							</div>
						</button>
					</div>
				</div>
			</div>

			<div className="mx-auto max-w-7xl border-t border-[#1B2722] pt-8">
				<div className="mb-8 flex flex-col items-center justify-between gap-6 sm:flex-row">
					<p className="text-xs text-[#A0A0A0]">
						© 2026 Sportsdey, All Right Reserved.
					</p>
					<div className="flex items-center gap-3">
						{footerSocials.map(({ icon: Icon, label, link }) => (
							<a
								key={label}
								href={link}
								target="_blank"
								rel="noopener noreferrer"
								className="group flex items-center justify-center transition-all duration-300 hover:-translate-y-1 cursor-pointer"
								aria-label={label}
							>
								<Icon className="h-7 w-7 text-black transition-colors" />
							</a>
						))}
					</div>
				</div>

				<div className="mb-8 space-y-6 text-center text-[10px] text-[#A0A0A0] sm:text-xs">
					<p className="mx-auto max-w-4xl leading-relaxed">
						This Website and the "Sportsdey" trademark are owned and operated by Halla Gaming Limited, a company established in Nigeria with RC1396896, having its registered address at First Floor, Lagos City Mall, Onikan, Lagos state. Halla Gaming Limited is licensed and regulated by the National Lottery Regulatory Commission under license 00000010, issued on the 15th of August 2023.
					</p>
				</div>

				{/* Payment Providers Placeholder */}
				<div className="flex flex-wrap items-center justify-center gap-3">
					{["OPay", "PalmPay", "Kele", "fincra", "paystack", "paga", "Veedez", "BillerOne"].map((provider) => (
						<div key={provider} className="flex h-8 items-center justify-center rounded bg-white px-3 text-xs font-bold text-black">
							{provider}
						</div>
					))}
				</div>
			</div>
		</footer>
	);
}
