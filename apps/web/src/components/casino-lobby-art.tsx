import { type ComponentType, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type CasinoLobbyArtProps = {
	src: string | null | undefined;
	fallbackSrc?: string | null;
	name: string;
	icon?: ComponentType<{ className?: string }>;
	dimmed?: boolean;
	compact?: boolean;
};

function uniqueSrcs(
	src: string | null | undefined,
	fallbackSrc: string | null | undefined,
): string[] {
	const out: string[] = [];
	for (const value of [src, fallbackSrc]) {
		const trimmed = value?.trim();
		if (trimmed && !out.includes(trimmed)) out.push(trimmed);
	}
	return out;
}

/** Thumbnail with a title fallback when the CDN URL is missing or fails. */
export function CasinoLobbyArt({
	src,
	fallbackSrc,
	name,
	icon: Icon,
	dimmed = false,
	compact = false,
}: CasinoLobbyArtProps) {
	const candidates = useMemo(
		() => uniqueSrcs(src, fallbackSrc),
		[src, fallbackSrc],
	);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		setAttempt(0);
	}, [src, fallbackSrc]);

	const current = candidates[attempt];
	const showImage = Boolean(current);

	if (showImage) {
		return (
			<img
				src={current}
				alt={name}
				loading="lazy"
				referrerPolicy="no-referrer"
				className="absolute inset-0 h-full w-full object-cover"
				style={{ opacity: dimmed ? 0.35 : 1 }}
				onError={() => {
					setAttempt((n) => n + 1);
				}}
			/>
		);
	}

	if (Icon) {
		return (
			<Icon
				className={cn(
					"pointer-events-none absolute inset-0 z-0 m-auto h-[72%] w-[72%]",
					compact ? "p-2" : "p-3",
				)}
			/>
		);
	}

	return (
		<span
			className={cn(
				"absolute inset-0 z-[1] flex items-end justify-center bg-gradient-to-t from-black/80 via-black/25 to-transparent px-1.5 text-center font-semibold text-white leading-tight",
				compact ? "py-1.5 text-[11px]" : "py-2.5 text-xs",
			)}
		>
			<span className="line-clamp-3">{name}</span>
		</span>
	);
}
