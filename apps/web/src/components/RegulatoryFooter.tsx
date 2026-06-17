import { FileText, MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "./ui/button";

const RegulatoryFooter = () => {
	return (
		<div className="border-gray-200 border-t bg-[#f8f9fa] px-6 py-8 dark:border-gray-800 dark:bg-[#1a1b1a]">
			<div className="mx-auto max-w-7xl space-y-4 text-center">
				<p className="mx-auto max-w-4xl text-left text-primary text-xs leading-relaxed sm:text-sm dark:text-gray-400">
					This Website and the “Sportsdey” trademark are owned and operated by
					Halla Gaming Limited, a company established in Nigeria with RC1396896,
					having its registered address at First floor, Lagos City Mall, Onikan,
					Lagos state. Halla Gaming Limited is licensed and regulated by the
					National Lottery Regulatory Commission under license 00000010, issued
					on the 15th of August 2023.
				</p>
				<div className="flex flex-wrap justify-center gap-4 pt-2 font-bold text-[10px] text-primary uppercase tracking-wider sm:text-xs dark:text-white">
					<span>Play Responsibly</span>
					<span className="text-gray-300 dark:text-gray-600">|</span>
					<span>18+ Only</span>
					<span className="text-gray-300 dark:text-gray-600">|</span>
					<span>Please Gamble Responsibly</span>
				</div>
			</div>
			<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
				<Button
					className="gap-2 bg-[#25D366] text-white hover:bg-[#25D366]/90"
					asChild
				>
					<a
						href="https://wa.link/25tnk8"
						target="_blank"
						rel="noopener noreferrer"
					>
						<PhoneCall className="h-4 w-4" />
						Contact us
					</a>
				</Button>

				<Button variant="outline" className="gap-2" asChild>
					<a
						href="https://docs.google.com/forms/d/e/1FAIpQLSeky7VWLGyycdRGq-fpHsx_wr2UHvS49kautpHliRFz7bYhiw/viewform?usp=publish-editor"
						target="_blank"
						rel="noopener noreferrer"
					>
						<MessageCircle className="h-4 w-4" />
						Give Feedback
					</a>
				</Button>
			</div>
		</div>
	);
};

export default RegulatoryFooter;
