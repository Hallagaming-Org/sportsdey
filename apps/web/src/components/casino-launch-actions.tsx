import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CasinoLaunchActionsProps = {
	/** Show overlay (mobile tap / forced). Desktop also shows on group-hover. */
	active?: boolean;
	loading?: boolean;
	compact?: boolean;
	onDemo: () => void;
	onPlay: () => void;
};

/**
 * Betpawa/Msport-style dual CTA: Try Demo + Play Now.
 * Parent should use `group` class for desktop hover reveal.
 */
export function CasinoLaunchActions({
	active = false,
	loading = false,
	compact = false,
	onDemo,
	onPlay,
}: CasinoLaunchActionsProps) {
	return (
		<div
			className={cn(
				"absolute inset-0 z-[2] flex flex-col items-center justify-center bg-black/55 px-2 transition-opacity duration-150",
				active
					? "pointer-events-auto opacity-100"
					: "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
			)}
		>
			{loading ? (
				<Loader2
					className={cn(
						"animate-spin text-white",
						compact ? "h-5 w-5" : "h-8 w-8",
					)}
				/>
			) : (
				<div
					className={cn(
						"flex w-full flex-col items-stretch",
						compact ? "max-w-[92px] gap-1" : "max-w-[140px] gap-1.5",
					)}
				>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onDemo();
						}}
						className={cn(
							"w-full rounded-md bg-[#E8E8E8] font-semibold text-black transition hover:bg-white",
							compact ? "px-1.5 py-1 text-[9px]" : "px-3 py-2 text-xs",
						)}
					>
						Try Demo
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onPlay();
						}}
						className={cn(
							"w-full rounded-md bg-[#F5C518] font-semibold text-black transition hover:bg-[#ffd84a]",
							compact ? "px-1.5 py-1 text-[9px]" : "px-3 py-2 text-xs",
						)}
					>
						Play Now
					</button>
				</div>
			)}
		</div>
	);
}
