import { Info } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

type LoyaltyHeaderProps = {
	howItWorksSteps?: string[];
};

const DEFAULT_HOW_IT_WORKS_STEPS = [
	"Place bets and keep playing to earn loyalty points.",
	"As your points grow, you unlock higher loyalty levels.",
	"Hit each reward’s point cost to redeem it from Recommended For You.",
	"Use Recent Activity to track points you’ve earned or spent.",
] as const;


export function LoyaltyHeader({
	howItWorksSteps = [...DEFAULT_HOW_IT_WORKS_STEPS],
}: LoyaltyHeaderProps) {
	const steps =
		howItWorksSteps.length > 0
			? howItWorksSteps
			: [...DEFAULT_HOW_IT_WORKS_STEPS];

	return (
		<div className="mb-6 flex items-center gap-14 sm:justify-between sm:gap-4">
			<div>
				<h1 className="font-extrabold text-2xl text-gray-900 sm:text-3xl dark:text-white">
					Loyalty Club
				</h1>
				<p className="mt-1 max-w-md text-sm text-gray-500 dark:text-[#8C8F8F]">
					Earn points as you play, climb levels, and redeem rewards.
				</p>
			</div>

			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-[#1B2722] bg-transparent px-2 py-2 font-semibold text-gray-600 text-xs transition-colors hover:border-accent hover:text-accent dark:text-[#C8CBCB]"
					>
						<span className="hidden sm:block">How Loyalty Works</span>
						<Info className="size-3.5" />
					</button>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					className="w-96 border-[#1B2722] bg-[#151616] text-[#C8CBCB] text-sm"
				>
					<p className="font-semibold text-white">How loyalty works</p>
					<ol className="mt-3 list-decimal space-y-2.5 pl-4 text-[#8C8F8F]">
						{steps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
				</PopoverContent>
			</Popover>
		</div>
	);
}
