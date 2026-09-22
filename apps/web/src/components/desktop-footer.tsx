import { Link } from "@tanstack/react-router";
import { Apple, GooglePlay } from "iconsax-reactjs";
import { useCurrentSport } from "@/hooks/use-current-sport";
import DiscordFooter from "@/logos/DiscordFooter";
import FacebookFooterIcon from "@/logos/FacebookFooterIcon";
// import FlutterwaveLogo from "@/logos/flutterwave.png";
import InstagramFooter from "@/logos/InstagramFooter";
import KudaLogo from "@/logos/kuda.png";
import MastercardLogo from "@/logos/mastercard.png";
import MonnifyLogo from "@/logos/monnify.png";
import NewSportsdeyLogo from "@/logos/NewSportsdeyLogo.svg?react";
import OPayLogo from "@/logos/opay.png";
import PalmPayLogo from "@/logos/palmpay.png";
import PaystackLogo from "@/logos/paystack.png";
import TelegramFooter from "@/logos/TelegramFooter";
import Whatsapp from "@/logos/Whatsapp";
import XFooter from "@/logos/XFooter";

const footerSocials = [
	{
		icon: FacebookFooterIcon,
		label: "Facebook",
		link: "https://facebook.com/sportsdey247",
	},
	{ icon: XFooter, label: "Twitter/X", link: "https://X.com/sportsdey247" },
	{
		icon: InstagramFooter,
		label: "Instagram",
		link: "https://Instagram.com/Sportsdey247",
	},
	{ icon: TelegramFooter, label: "Telegram", link: "https://t.me/sportsdey2" },
	{ icon: Whatsapp, label: "WhatsApp", link: "https://wa.link/25tnk8" },
	{
		icon: DiscordFooter,
		label: "Discord",
		link: "https://discord.gg/AKRc3K2v",
	},
];

export default function DesktopFooter() {
	const currentSport = useCurrentSport();

	return (
		<footer className="w-full border-[#1B2722] border-t bg-[#000606] px-4 py-12 text-white transition-colors lg:px-[104px]">
			<div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-5 lg:grid-cols-6">
				<div className="space-y-4 md:col-span-2 lg:col-span-2">
					<div className="flex items-center gap-3">
							<img
								src="/sportsdey-logo.png"
								width={128}
								height={32}
								className="hidden h-8 w-auto dark:block"
								alt="SportsDey"
								decoding="async"
							/>
						<NewSportsdeyLogo className="h-8 w-auto text-white dark:hidden" />
						<div className="flex h-6 items-center rounded-full bg-[#1A1A1A] px-3 font-medium text-[10px] text-gray-300">
							EN <span className="ml-1 text-[8px]">▼</span>
						</div>
					</div>
					<p className="max-w-xs text-[#A0A0A0] text-sm leading-relaxed">
						Nigeria's all-in-one gaming platform.
					</p>

					<div className="mt-6 flex items-start gap-3">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#FF0606] font-bold text-[#FF0606] text-[10px]">
							18+
						</div>
						<p className="max-w-[250px] text-[#A0A0A0] text-xs leading-relaxed">
							All Players must be 18 or older to register or play. Please Gamble
							responsibly
						</p>
					</div>
				</div>

				<div className="flex flex-row justify-between gap-4 md:contents">
					<div className="flex-1 md:flex-none">
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
									search={{ sports: currentSport }}
									className="text-[#A0A0A0] transition-colors hover:text-white"
								>
									News
								</Link>
							</li>

							<li>
								<Link
									to="/news"
									search={{ sports: currentSport }}
									className="text-[#A0A0A0] transition-colors hover:text-white"
								>
									Videos
								</Link>
							</li>
							<li>
								<Link
									to="/faqs"
									className="text-[#A0A0A0] transition-colors hover:text-white"
								>
									FAQs
								</Link>
							</li>
							<li>
								<a
									href="https://partners.sportsdey.com"
									target="_blank"
									rel="noopener noreferrer"
									className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
								>
									Become an affiliate
								</a>
							</li>
						</ul>
					</div>

					<div className="flex-1 md:flex-none">
						<h3 className="mb-6 font-bold text-base text-white">Our Ecosystem</h3>
						<ul className="space-y-4 text-sm">
							<li>
								<a
									href="https://prediction.sportsdey.com/"
									target="_blank"
									rel="noopener noreferrer"
									className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
								>
									Prediction Market
								</a>
							</li>
							<li>
								<a
									href="https://binary.sportsdey.com/sportsdayApi/connectSportsDay"
									target="_blank"
									rel="noopener noreferrer"
									className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
								>
									Binary Trading
								</a>
							</li>
							<li>
								<Link
									to="/tournaments"
									className="block text-[#A0A0A0] transition-colors hover:text-white"
								>
									Tournaments
								</Link>
							</li>

						</ul>
					</div>
				</div>

				<div>
					<h3 className="mb-6 font-bold text-base text-white">
						About SportsDey
					</h3>
					<ul className="mb-8 space-y-4 text-sm">
						<li>
							<Link
								to="/about"
								className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
							>
								About Us
							</Link>
						</li>
						<li>
							<a
								href="https://wa.link/25tnk8"
								target="_blank"
								rel="noopener noreferrer"
								className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
							>
								Contact Us
							</a>
						</li>
						<li>
							<Link
								to="/terms"
								className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
							>
								Terms and Conditions
							</Link>
						</li>
						<li>
							<Link
								to="/general-betting-rules"
								className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
							>
								General Betting Rules
							</Link>
						</li>
						<li>
							<Link
								to="/privacy-policy"
								className="block cursor-pointer text-[#A0A0A0] transition-colors hover:text-white"
							>
								Privacy Policy
							</Link>
						</li>
					</ul>
				</div>

				<div className="flex w-full flex-row items-center justify-center gap-3 md:flex-col lg:items-start">
					<button
						type="button"
						aria-label="Download on the App Store"
						className="flex w-[150px] cursor-pointer items-center gap-3 rounded-xl border border-[#F8F8F8] bg-[#041107] px-3 py-2 transition-colors hover:bg-white/5"
						onClick={() => window.open("https://apps.apple.com", "_blank")}
					>
						<Apple size={20} color="white" variant="Bold" />
						<div className="flex flex-col items-start">
							<span className="text-[9px] text-gray-400 leading-tight">
								Download on
							</span>
							<span className="font-semibold text-sm text-white leading-tight">
								App store
							</span>
						</div>
					</button>
					<button
						type="button"
						aria-label="Get it on Google Play"
						className="flex w-[150px] cursor-pointer items-center gap-3 rounded-xl border border-[#F8F8F8] bg-[#041107] px-3 py-2 transition-colors hover:bg-white/5"
						onClick={() =>
							window.open("https://play.google.com/store/apps", "_blank")
						}
					>
						<GooglePlay size={20} color="white" variant="Bold" />
						<div className="flex flex-col items-start">
							<span className="text-[9px] text-gray-400 leading-tight">
								Get it on
							</span>
							<span className="font-semibold text-sm text-white leading-tight">
								Google Play
							</span>
						</div>
					</button>
				</div>
			</div>

			<div className="border-[#1B2722] border-t pt-8">
				<div className="mb-8 flex flex-col items-center justify-between gap-6 sm:flex-row">
					<p className="text-[#A0A0A0] text-xs">
						© 2026 Sportsdey, All Right Reserved.
					</p>
					<div className="flex items-center gap-3">
						{footerSocials.map(({ icon: Icon, label, link }) => (
							<a
								key={label}
								href={link}
								target="_blank"
								rel="noopener noreferrer"
								className="group flex cursor-pointer items-center justify-center transition-all duration-300 hover:-translate-y-1"
								aria-label={label}
							>
								<Icon className="h-7 w-7 text-black transition-colors" />
							</a>
						))}
					</div>
				</div>

				<div className="mb-8 space-y-6 text-center text-[#A0A0A0] text-[10px] sm:text-xs">
					<p className="mx-auto max-w-4xl leading-relaxed">
						This Website and the "Sportsdey" trademark are owned and operated by
						Halla Gaming Limited, a company established in Nigeria with
						RC1396896, having its registered address at 100 IBB Way, Municipal
						Calabar. Halla Gaming Limited is Licensed by the Cross River State
						Lottery and Gaming agency under license number CRSLGA/11/2025/014
						issued on 30th of November, 2025.
					</p>
				</div>
				<div className="flex min-h-[40px] flex-wrap items-center justify-center gap-2 md:min-h-[58px]">
					{[
						{ name: "OPay", logo: OPayLogo },
						{ name: "PalmPay", logo: PalmPayLogo },
						{ name: "Paystack", logo: PaystackLogo },
						{ name: "Monnify", logo: MonnifyLogo },
						{ name: "Mastercard", logo: MastercardLogo },
						{ name: "Kuda", logo: KudaLogo },
						// { name: "Flutterwave", logo: FlutterwaveLogo },
					].map((provider) => (
						<div
							key={provider.name}
							className="flex h-[40px] w-[80px] md:h-[58px] md:w-[116.98px] items-center justify-center rounded"
						>
							<img
								src={provider.logo}
								alt={provider.name}
								width={117}
								height={58}
								decoding="async"
								className="h-full w-auto object-contain"
							/>
						</div>
					))}
				</div>
			</div>
		</footer>
	);
}
