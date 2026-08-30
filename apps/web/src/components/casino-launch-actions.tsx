import { Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type CasinoLaunchActionsProps = {
	/** Show overlay (tap-selected). Desktop also reveals on fine-pointer hover. */
	active?: boolean;
	loading?: boolean;
	compact?: boolean;
	onDemo: () => void;
	onPlay: () => void;
};

/**
 * In-card CTAs for desktop hover. Parent should use `group`.
 * On touch, prefer {@link CasinoLaunchSheet} — hover is unreliable.
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
				"absolute inset-0 z-20 hidden flex-col items-center justify-center bg-black/55 px-2 transition-opacity duration-150 md:flex",
				active
					? "pointer-events-auto opacity-100"
					: "pointer-events-none opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
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
							"w-full rounded-md bg-[#1BAA04] font-semibold text-white transition hover:bg-[#158a03]",
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

type CasinoLaunchSheetProps = {
	open: boolean;
	gameName: string;
	loading?: boolean;
	onClose: () => void;
	onDemo: () => void;
	onPlay: () => void;
};

/** Mobile-friendly choice sheet: Try Demo vs Play Now. */
export function CasinoLaunchSheet({
	open,
	gameName,
	loading = false,
	onClose,
	onDemo,
	onPlay,
}: CasinoLaunchSheetProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center"
			role="presentation"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={`Play ${gameName}`}
				className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-[#202120] dark:border dark:border-gray-800"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mb-4 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Choose mode
						</p>
						<h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">
							{gameName}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="shrink-0 rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
						aria-label="Close"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin text-[#1BAA04]" />
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<button
							type="button"
							onClick={onDemo}
							className="w-full rounded-xl bg-[#E8E8E8] px-4 py-3.5 text-base font-semibold text-black transition hover:bg-white dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
						>
							Try Demo
						</button>
						<button
							type="button"
							onClick={onPlay}
							className="w-full rounded-xl bg-[#1BAA04] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#158a03]"
						>
							Play Now
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
