import { useEffect, useState } from "react";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import type { BannerData } from "@/lib/banners-server";
import { trackWebengageEvent } from "@/lib/webengage";

interface BannerCarouselProps {
	banners: BannerData[];
}

/**
 * Matches `toImageSizes().hero` on the server (1200×630).
 * Used as the reserved box so the carousel does not shift on load.
 */
export const BANNER_ASPECT_RATIO = "1200 / 630";

/**
 * Transform an already-built Sanity CDN URL.
 *
 * The official `@sanity/image-url` builder lives on the server
 * (`toImageSizes` → `hero`). The web app only receives a URL string,
 * so we apply the same query params the builder emits (`w`, `q`,
 * `auto=format`, `fit=max`) instead of adding that package here.
 */
export function bannerImageUrl(source: string, width: number): string {
	try {
		const url = new URL(source);
		if (!url.hostname.endsWith("sanity.io")) return source;
		url.searchParams.delete("h");
		url.searchParams.set("w", String(width));
		url.searchParams.set("q", "75");
		url.searchParams.set("auto", "format");
		url.searchParams.set("fit", "max");
		return url.toString();
	} catch {
		return source;
	}
}

function BannerSlide({
	banner,
	priority,
}: {
	banner: BannerData;
	priority: boolean;
}) {
	const mobileUrl = bannerImageUrl(banner.imageUrl, 640);
	const tabletUrl = bannerImageUrl(banner.imageUrl, 1024);
	const desktopUrl = bannerImageUrl(banner.imageUrl, 1440);

	return (
		<a
			href={banner.url}
			target="_blank"
			rel="noopener noreferrer"
			className="absolute inset-0 block"
			onClick={() =>
				trackWebengageEvent("Banner Clicked", {
					"Banner Name":
						banner.title?.trim() || banner.alt?.trim() || "Banner",
					"Banner ID": banner._id,
					Image: banner.imageUrl,
				})
			}
		>
			<img
				src={mobileUrl}
				srcSet={`${mobileUrl} 640w, ${tabletUrl} 1024w, ${desktopUrl} 1440w`}
				sizes="(min-width: 1024px) 70vw, 100vw"
				alt={banner.alt || "Banner"}
				width={1200}
				height={630}
				loading={priority ? "eager" : "lazy"}
				fetchPriority={priority ? "high" : "auto"}
				decoding="async"
				className="h-full w-full object-cover"
			/>
		</a>
	);
}

const BannerCarousel = ({ banners }: BannerCarouselProps) => {
	const [mountRest, setMountRest] = useState(false);
	const first = banners[0];

	useEffect(() => {
		if (banners.length <= 1) return;

		const mount = () => setMountRest(true);
		let idleId: number | undefined;
		let timeoutId: number | undefined;

		if ("requestIdleCallback" in window) {
			idleId = window.requestIdleCallback(mount, { timeout: 2500 });
		} else {
			timeoutId = window.setTimeout(mount, 2000);
		}

		return () => {
			if (idleId != null) window.cancelIdleCallback(idleId);
			if (timeoutId != null) window.clearTimeout(timeoutId);
		};
	}, [banners.length]);

	if (!first) return null;

	const slides = mountRest ? banners : [first];

	return (
		<div
			className="relative w-full overflow-hidden rounded-xl"
			style={{ aspectRatio: BANNER_ASPECT_RATIO }}
			onPointerDownCapture={() => {
				if (banners.length > 1) setMountRest(true);
			}}
		>
			{slides.length === 1 ? (
				<BannerSlide banner={first} priority />
			) : (
				<Swiper
					modules={[Autoplay, Pagination]}
					autoplay={{
						delay: 5000,
						disableOnInteraction: false,
						pauseOnMouseEnter: true,
					}}
					pagination={{ clickable: true }}
					loop={slides.length > 1}
					className="h-full w-full"
				>
					{slides.map((banner, index) => (
						<SwiperSlide key={banner._id} className="!h-full">
							<BannerSlide banner={banner} priority={index === 0} />
						</SwiperSlide>
					))}
				</Swiper>
			)}
		</div>
	);
};

export default BannerCarousel;
