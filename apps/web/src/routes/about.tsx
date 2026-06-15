import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
	component: AboutUsPage,
});

function AboutUsPage() {
	return (
		<div className="flex min-h-screen flex-col items-center bg-[#000606] px-4 text-white">
			<div className="flex w-full max-w-3xl flex-col items-center">
				<div className="mb-2 w-full rounded-2xl border border-[#1A1A1A] pt-4 text-[#A0A0A0]">
					<h1 className="mb-3 px-6 text-left font-bold text-3xl sm:text-4xl">
						About Us
					</h1>
					<p className="mb-8 px-6 text-left text-[#A0A0A0] text-sm sm:text-base">
						Learn more about SportsDey and our mission.
					</p>
				</div>

				<div className="mb-10 w-full rounded-2xl border border-[#1A1A1A] bg-[#0B100E] p-8 text-[#A0A0A0] leading-relaxed">
					<p className="mb-4">
						Welcome to SportsDey. We are committed to providing the best sports
						betting and entertainment experience. (This is a placeholder for
						your About Us content. You can replace this text with your actual
						company information.)
					</p>
				</div>
			</div>
		</div>
	);
}
