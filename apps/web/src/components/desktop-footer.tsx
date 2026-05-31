import { Link } from "@tanstack/react-router";
import { useCurrentSport } from "@/hooks/use-current-sport";
import DiscordIcon from "@/logos/discord.svg?react";
import FacebookIcon from "@/logos/facebook.svg?react";
import InstagramIcon from "@/logos/instagram.svg?react";
import TelegramIcon from "@/logos/telegram.svg?react";
import WhatsappIcon from "@/logos/whatsapp.svg?react";
import XIcon from "@/logos/x.svg?react";

export default function DesktopFooter() {
	const currentSport = useCurrentSport();

	return (
		<footer className="hidden w-full border-gray-200 border-t bg-[#f8f9fa] px-6 py-12 text-foreground transition-colors lg:block dark:border-gray-800 dark:bg-[#111211]">
			<div className="mx-auto mb-8 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-5">
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<img
							src="/sportsdey-logo.png"
							className="h-10 dark:brightness-100"
							alt="SportsDey Logo"
						/>
					</div>
					<p className="max-w-xs text-gray-500 text-sm leading-relaxed dark:text-gray-400">
						Your #1 Sports Hub for News, Scores, Tips & More.
					</p>
				</div>

				<div>
					<h3 className="mb-4 font-bold text-base text-gray-800 dark:text-white">
						Quick Links
					</h3>
					<ul className="space-y-2.5 text-sm">
						<li>
							<Link
								to="/"
								search={{ sports: currentSport }}
								className="text-gray-500 transition-colors hover:text-accent dark:text-gray-400"
							>
								Matches
							</Link>
						</li>
						<li>
							<Link
								to="/news"
								search={{ sports: currentSport, tab: "news" }}
								className="text-gray-500 transition-colors hover:text-accent dark:text-gray-400"
							>
								News
							</Link>
						</li>
						<li>
							<Link
								to="/betting"
								className="text-gray-500 transition-colors hover:text-accent dark:text-gray-400"
							>
								Tips
							</Link>
						</li>
						<li>
							<Link
								to="/news"
								search={{ sports: currentSport, tab: "videos" }}
								className="text-gray-500 transition-colors hover:text-accent dark:text-gray-400"
							>
								Videos
							</Link>
						</li>
					</ul>
				</div>

				<div>
					<h3 className="mb-4 font-bold text-base text-gray-800 dark:text-white">
						Popular Leagues
					</h3>
					<ul className="space-y-2.5 text-sm">
						<li>
							<span className="text-gray-500 dark:text-gray-400">
								Premier Leagues
							</span>
						</li>
						<li>
							<span className="text-gray-500 dark:text-gray-400">La Liga</span>
						</li>
						<li>
							<span className="text-gray-500 dark:text-gray-400">Seria A</span>
						</li>
						<li>
							<span className="text-gray-500 dark:text-gray-400">
								Champions Leagues
							</span>
						</li>
					</ul>
				</div>

				<div>
					<h3 className="mb-4 font-bold text-base text-gray-800 dark:text-white">
						About SportsDey
					</h3>
					<ul className="space-y-2.5 text-sm">
						<li>
							<span className="cursor-pointer text-gray-500 transition-colors hover:text-accent dark:text-gray-400">
								About Us
							</span>
						</li>
						<li>
							<span className="cursor-pointer text-gray-500 transition-colors hover:text-accent dark:text-gray-400">
								Contact Us
							</span>
						</li>
						<li>
							<span className="cursor-pointer text-gray-500 transition-colors hover:text-accent dark:text-gray-400">
								Terms and Conditions
							</span>
						</li>
						<li>
							<span className="cursor-pointer text-gray-500 transition-colors hover:text-accent dark:text-gray-400">
								Privacy Policy
							</span>
						</li>
					</ul>
				</div>

				<div>
					<h3 className="mb-4 font-bold text-base text-gray-800 dark:text-white">
						Follow Us
					</h3>
					<p className="mb-3 text-gray-500 text-xs dark:text-gray-400">
						For more updates follow us on:
					</p>
					<div className="flex items-center gap-3">
						<a
							href="https://facebook.com/sportsdey247"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors"
							aria-label="Facebook"
						>
							<FacebookIcon className="h-4 w-4 fill-current" />
						</a>
						<a
							href="https://X.com/sportsdey247"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors"
							aria-label="Twitter/X"
						>
							<XIcon className="h-4 w-4 fill-current" />
						</a>
						<a
							href="https://Instagram.com/Sportsdey247"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors"
							aria-label="Instagram"
						>
							<InstagramIcon className="h-4 w-4" />
						</a>
						<a
							href="https://t.me/sportsdey2"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors"
							aria-label="Telegram"
						>
							<TelegramIcon className="h-4 w-4 fill-current" />
						</a>
						<a
							href="https://t.me/sportsdey2"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors"
							aria-label="whatsapp"
						>
							<WhatsappIcon className="h-4 w-4 fill-current" />
						</a>
						<a
							href="https://discord.gg/AKRc3K2v"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors"
							aria-label="whatsapp"
						>
							<DiscordIcon className="h-4 w-4 fill-current" />
						</a>
					</div>
				</div>
			</div>

			<div className="mx-auto flex max-w-7xl items-center justify-center border-gray-200 border-t pt-8 dark:border-gray-800">
				<p className="text-gray-500 text-xs dark:text-gray-400">
					© 2026 Sportsdey. All Right Reserved.
				</p>
			</div>
		</footer>
	);
}
