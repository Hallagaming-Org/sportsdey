import { clsx } from "clsx";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import type { BannerData } from "@/lib/banners-server";

interface BannerCarouselProps {
	banners: BannerData[];
}

const BannerCarousel = ({ banners }: BannerCarouselProps) => {
	const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 }, [
		Autoplay({
			delay: 5000,
			stopOnInteraction: true,
			stopOnMouseEnter: true,
		}),
	]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

	const onDotButtonClick = useCallback(
		(index: number) => {
			if (!emblaApi) return;
			emblaApi.scrollTo(index);
		},
		[emblaApi],
	);

	const onInit = useCallback(() => {
		if (!emblaApi) return;
		setScrollSnaps(emblaApi.scrollSnapList());
	}, [emblaApi]);

	const onSelect = useCallback(() => {
		if (!emblaApi) return;
		setSelectedIndex(emblaApi.selectedScrollSnap());
	}, [emblaApi]);

	useEffect(() => {
		if (!emblaApi) return;

		onInit();
		onSelect();

		emblaApi.on("reInit", onInit);
		emblaApi.on("reInit", onSelect);
		emblaApi.on("select", onSelect);

		return () => {
			emblaApi.off("reInit", onInit);
			emblaApi.off("reInit", onSelect);
			emblaApi.off("select", onSelect);
		};
	}, [emblaApi, onInit, onSelect]);

	if (banners.length === 0) {
		return null;
	}

	if (banners.length === 1) {
		const banner = banners[0];
		return (
			<a
				href={banner.url}
				target="_blank"
				rel="noopener noreferrer"
				className="block w-full overflow-hidden rounded-xl aspect-[16/10] sm:aspect-[16/9] md:aspect-[21/9]"
			>
				<img
					src={banner.imageUrl}
					alt={banner.alt || "Banner"}
					className="h-full w-full object-cover"
				/>
			</a>
		);
	}

	return (
		<div className="relative w-full">
			<div className="overflow-hidden" ref={emblaRef}>
				<div className="flex">
					{banners.map((banner) => (
						<div
							key={banner._id}
							className="relative min-w-full flex-[0_0_100%]"
						>
							<a
								href={banner.url}
								target="_blank"
								rel="noopener noreferrer"
								className="block w-full overflow-hidden rounded-xl"
							>
								<img
									src={banner.imageUrl}
									alt={banner.alt || "Banner"}
									className="w-full h-auto object-contain"
								/>
							</a>
						</div>
					))}
				</div>
			</div>
			<div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
				{scrollSnaps.map((_, index) => (
					<button
						key={index}
						type="button"
						onClick={() => onDotButtonClick(index)}
						className={clsx(
							"h-2 w-2 rounded-full border-0 transition-all duration-200",
							index === selectedIndex
								? "bg-white opacity-100 shadow-lg"
								: "bg-white/50 opacity-60 hover:opacity-80",
						)}
						aria-label={`Go to slide ${index + 1}`}
					/>
				))}
			</div>
		</div>
	);
};

export default BannerCarousel;
