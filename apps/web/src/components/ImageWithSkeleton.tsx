import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ImageWithSkeletonProps
	extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "onLoad" | "onError"> {
	wrapperClassName?: string;
	skeletonClassName?: string;
}

function ImageWithSkeleton({
	src,
	alt,
	className,
	wrapperClassName,
	skeletonClassName,
	...imgProps
}: ImageWithSkeletonProps) {
	const [loaded, setLoaded] = useState(false);
	const [errored, setErrored] = useState(false);

	return (
		<span
			className={cn("relative block overflow-hidden", wrapperClassName)}
		>
			{!loaded && !errored && (
				<span
					aria-hidden
					className={cn(
						"absolute inset-0 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
						skeletonClassName,
					)}
				/>
			)}
			<img
				src={src}
				alt={alt}
				loading="lazy"
				decoding="async"
				onLoad={() => setLoaded(true)}
				onError={() => setErrored(true)}
				className={cn(
					"h-full w-full transition-opacity duration-300",
					loaded ? "opacity-100" : "opacity-0",
					className,
				)}
				{...imgProps}
			/>
		</span>
	);
}

export { ImageWithSkeleton };
