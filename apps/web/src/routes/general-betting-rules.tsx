import { createFileRoute } from "@tanstack/react-router";
import { bettingRulesData } from "../data/betting-rules";

export const Route = createFileRoute("/general-betting-rules")({
	component: BettingRulesPage,
});

function BettingRulesPage() {
	return (
		<div className="flex min-h-screen flex-col items-center bg-[#000606] px-4 text-white">
			<div className="flex w-full max-w-4xl flex-col items-center">
				<div className="mb-2 w-full rounded-2xl border border-[#1A1A1A] pt-4 text-[#A0A0A0]">
					<h1 className="mb-3 px-6 text-left font-bold text-3xl sm:text-4xl">
						General Betting Rules
					</h1>
					<p className="mb-8 px-6 text-left text-[#A0A0A0] text-sm sm:text-base">
						Please read our general betting rules carefully.
					</p>
				</div>

				<div className="mb-10 w-full rounded-2xl border border-[#1A1A1A] bg-[#0B100E] p-8 text-[#A0A0A0] leading-relaxed">
					{bettingRulesData.map((section, index) => (
						<div key={index} className="mb-8 last:mb-0">
							<h2 className="mb-4 font-bold text-white text-xl">
								{`${index + 1}. ${section.title}`}
							</h2>
							<div className="space-y-4">
								{section.paragraphs.map((paragraph, pIndex) => (
									<p key={pIndex} className="text-sm sm:text-base">
										{paragraph}
									</p>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
