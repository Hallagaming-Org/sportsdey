import { createFileRoute } from "@tanstack/react-router";
import { privacyPolicyData } from "@/data/privacy-policy";

export const Route = createFileRoute("/privacy-policy")({
	component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
	return (
		<div className="flex min-h-screen flex-col items-center bg-[#000606] px-4 text-white">
			<div className="flex w-full max-w-4xl flex-col items-center">
				<div className="mb-2 w-full rounded-2xl border border-[#1A1A1A] pt-4 text-[#A0A0A0]">
					<h1 className="mb-3 px-6 text-left font-bold text-3xl sm:text-4xl">
						Privacy Policy
					</h1>
					<p className="mb-8 px-6 text-left text-[#A0A0A0] text-sm sm:text-base">
						How SportsDey collects, uses, and protects your personal information.
					</p>
				</div>

				<div className="mb-10 w-full rounded-2xl border border-[#1A1A1A] bg-[#0B100E] p-8 text-[#A0A0A0] leading-relaxed">
					{privacyPolicyData.map((section, index) => (
						<div key={index} className="mb-8 last:mb-0">
							<h2 className="mb-4 font-bold text-white text-xl">
								{`${index + 1}. ${section.title}`}
							</h2>
							{section.paragraphs && (
								<div className="space-y-4">
									{section.paragraphs.map((paragraph, pIndex) => (
										<p key={pIndex} className="text-sm sm:text-base">
											{paragraph}
										</p>
									))}
								</div>
							)}
							{section.list && (
								<ul className="mt-3 list-disc space-y-2 pl-6 text-sm sm:text-base">
									{section.list.map((item, lIndex) => (
										<li key={lIndex} className="text-[#A0A0A0]">
											{item}
										</li>
									))}
								</ul>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
