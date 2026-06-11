import { createFileRoute, Link } from "@tanstack/react-router";

import { termsData } from "../data/terms";

export const Route = createFileRoute("/terms")({
	component: TermsPage,
});

const sections = [
	{ id: "introduction", title: "INTRODUCTION AND CONTRACTING PARTIES" },
	{ id: "availability", title: "AVAILABILITY OF THE WEBSITE AND SERVICES" },
	{ id: "amendments", title: "AMENDMENTS TO THE TERMS OF USE" },
	{ id: "registration", title: "REGISTRATION AND ACCOUNT MANAGEMENT" },
	{ id: "deposits", title: "DEPOSITS AND WITHDRAWALS" },
	{ id: "placing-bets", title: "PLACING BETS" },
	{ id: "bonuses", title: "BONUSES / PROMOTIONS & REWARDS" },
	{ id: "responsible-gaming", title: "RESPONSIBLE GAMING" },
	{ id: "errors", title: "ERRORS AND OMISSIONS" },
	{ id: "no-warranty", title: "NO WARRANTY" },
	{ id: "limitations", title: "LIMITATIONS OF LIABILITY" },
	{ id: "intellectual-property", title: "INTELLECTUAL PROPERTY RIGHTS" },
	{ id: "complaints", title: "COMPLAINTS AND CLAIMS" },
	{ id: "waiver", title: "WAIVER" },
	{ id: "severability", title: "SEVERABILITY" },
	{ id: "assignment", title: "ASSIGNMENT AND TRANSFER" },
	{ id: "relationship", title: "RELATIONSHIP AND THIRD PARTY RIGHTS" },
	{ id: "applicable-law", title: "APPLICABLE LAW AND PLACE OF JURISDICTION" },
	{ id: "entire-agreement", title: "ENTIRE AGREEMENT" },
];

const toc = sections.map((s, i) => ({ ...s, number: i + 1 }));

function TermsPage() {
	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<div className="min-h-screen bg-[#000606] text-white px-4 flex flex-col items-center">
			<div className="w-full max-w-4xl flex flex-col items-center">
				<div className="w-full border pt-4 border-[#1A1A1A] rounded-2xl mb-2 text-[#A0A0A0]">
					<h1 className="text-3xl sm:text-4xl font-bold mb-3 text-left px-6">
						Terms and Conditions
					</h1>
					<p className="text-[#A0A0A0] mb-8 text-left text-sm sm:text-base px-6">
						Please read our terms and conditions carefully.
					</p>
				</div>

				<div className="w-full bg-[#0B100E] border border-[#1A1A1A] rounded-2xl p-8 mb-10 text-[#A0A0A0] leading-relaxed">
					{termsData.map((section, index) => (
						<div key={index} className="mb-8 last:mb-0">
							<h2 className="text-white text-xl font-bold mb-4">{`${index + 1}. ${section.title}`}</h2>
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
