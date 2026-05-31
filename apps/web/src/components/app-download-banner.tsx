import GooglePlayIcon from "@/logos/google-play.svg?react";
export default function AppDownloadBanner() {
	return (
		<div className="app-download-banner w-full rounded-2xl md:rounded-3xl p-8 md:p-12 
  flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 
  shadow-xl transition-all hover:shadow-2xl hover:scale-[1.005]">
			<div className="text-center md:text-left space-y-2">
				<h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-[#FFCF31] dark:text-[#F6E885] tracking-tight">
					Download the SportsDey App
				</h2>
				<p className="text-sm md:text-base lg:text-lg font-medium text-white/80">
					Better, Faster, Smarter.
				</p>
			</div>

			<div className="flex flex-wrap justify-center gap-4">
				{/* Apple App Store Button */}
				<a
					href="https://apps.apple.com"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-3 bg-[#0d5cf9] dark:bg-black hover:bg-[#0047d4] text-white px-5 py-3 rounded-xl border border-white/10 transition-colors shadow-md group"
				>
					<svg
						className="h-7 w-7 fill-white group-hover:scale-105 transition-transform"
						viewBox="0 0 24 24"
					>
						<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z" />
					</svg>
					<div className="text-left leading-none">
						<span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
							Download on the
						</span>
						<span className="text-sm font-extrabold tracking-tight block mt-0.5">
							App Store
						</span>
					</div>
				</a>

				{/* Google Play Store Button */}
				<a
					href="https://play.google.com"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-3 bg-[#0d5cf9] dark:bg-black hover:bg-[#0047d4] text-white px-5 py-3 rounded-xl border border-white/10 transition-colors shadow-md group"
				>
					<GooglePlayIcon className="h-7 w-7 fill-white group-hover:scale-105 transition-transform" />

					<div className="text-left leading-none">
						<span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
							Get it on
						</span>
						<span className="text-sm font-extrabold tracking-tight block mt-0.5">
							Google Play
						</span>
					</div>
				</a>
			</div>
		</div>
	);
}
