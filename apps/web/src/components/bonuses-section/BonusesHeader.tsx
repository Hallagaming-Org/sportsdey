import { Info } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export function BonusesHeader() {
	return (
		<div className="mb-6 flex items-center gap-14 sm:justify-between sm:gap-4">
			<div>
				<h1 className="font-extrabold text-2xl text-gray-900 sm:text-3xl dark:text-white">
					Bonuses
				</h1>
				<p className="mt-1 max-w-md text-sm text-gray-500 dark:text-[#8C8F8F]">
					Activate offers, wager through, and cash out when the requirement is
					done.
				</p>
			</div>

			<div className="flex flex-col gap-3 sm:items-center">
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-[#1B2722] bg-transparent px-2 py-2 font-semibold text-gray-600 text-xs transition-colors hover:border-accent hover:text-accent dark:text-[#C8CBCB]"
						>
							<span className="hidden sm:block">How Bonuses Work</span>
							<Info className="size-3.5" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="end"
						className="w-80 border-[#1B2722] bg-[#151616] text-[#C8CBCB] text-sm"
					>
						<p className="font-semibold text-white">How bonuses work</p>
						<ul className="mt-3 list-disc space-y-2 pl-4 text-[#8C8F8F]">
							<li>
								Admin publishes campaigns. Assigned bonuses show under Your
								bonuses.
							</li>
							<li>
								Activate to credit bonus funds to your bonus wallet, then play
								the listed games or sports.
							</li>
							<li>
								Bets and deposits already report to Bonus Engine for wagering.
							</li>
						</ul>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
