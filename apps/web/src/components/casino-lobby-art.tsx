import { type ComponentType, useState } from "react";
import { cn } from "@/lib/utils";

type CasinoLobbyArtProps = {
	src: string | null | undefined;
	name: string;
	icon?: ComponentType<{ className?: string }>;
	dimmed?: boolean;
	compact?: boolean;
};

/** Thumbnail with a title fallback when the CDN URL is missing or fails. */
export function CasinoLobbyArt({
	src,
	name,
	icon: Icon,
	dimmed = false,
	compact = false,
}: CasinoLobbyArtProps) {
	const [failed, setFailed] = useState(false);
	const showImage = Boolean(src) && !failed;

	if (showImage) {
		return (
			<img
				src={src as string}
				alt={name}
				loading="lazy"
				className="absolute inset-0 h-full w-full object-cover"
				style={{ opacity: dimmed ? 0.35 : 1 }}
				onError={() => setFailed(true)}
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
		<span className="absolute inset-x-0 bottom-0 z-[1] line-clamp-3 bg-gradient-to-t from-black/75 to-transparent px-1.5 py-1.5 text-center font-semibold text-[11px] text-white leading-tight">
			{name}
		</span>
	);
}
