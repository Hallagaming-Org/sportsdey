import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
	component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {


	return (
		<div className="min-h-screen bg-[#000606] text-white px-4 flex flex-col items-center">
			<div className="w-full max-w-3xl flex flex-col items-center">
				<div className="w-full border pt-4 border-[#1A1A1A] rounded-2xl mb-2 text-[#A0A0A0]">
					<h1 className="text-3xl sm:text-4xl font-bold mb-3 text-center">Privacy Policy</h1>
					<p className="text-[#A0A0A0] mb-8 text-center text-sm sm:text-base">
						How we collect, use, and protect your information.
					</p>
				</div>

				<div className="w-full bg-[#0B100E] border border-[#1A1A1A] rounded-2xl p-8 mb-10 text-[#A0A0A0] leading-relaxed">
					<p className="mb-4">
						(This is a placeholder for your Privacy Policy content. You can replace this text with your actual policy documentation.)
					</p>
				</div>
			</div>
		</div>
	);
}
