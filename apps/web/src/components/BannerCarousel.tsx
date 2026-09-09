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
 * Banners are authored at ~1500×500. The API hero URL also sends h=630,
 * which crops the sides and makes the slideshow taller. Drop height/rect
 * so the original wide crop is preserved.
 */
function bannerImageUrl(source: string, width: number): string {
	try {
		const url = new URL(source);
		if (!url.hostname.endsWith("sanity.io")) return source;
		url.searchParams.delete("h");
		url.searchParams.delete("rect");
		url.searchParams.set("w", String(width));
		url.searchParams.set("auto", "format");
		url.searchParams.set("fit", "max");
		return url.toString();
	} catch {
		return source;
	}
}

const BannerCarousel = ({ banners }: BannerCarouselProps) => {
	if (banners.length === 0) return null;

	return (
		<Swiper
			modules={[Autoplay, Pagination]}
			autoplay={{
				delay: 5000,
				disableOnInteraction: false,
				pauseOnMouseEnter: true,
			}}
			pagination={{ clickable: true }}
			loop={banners.length > 1}
			className="w-full rounded-xl"
		>
			{banners.map((banner, index) => {
				const imageUrl = bannerImageUrl(banner.imageUrl, 1440);
				const imageSrcSet = `${bannerImageUrl(banner.imageUrl, 640)} 640w, ${bannerImageUrl(banner.imageUrl, 1024)} 1024w, ${imageUrl} 1440w`;

				return (
					<SwiperSlide key={banner._id}>
						<a
							href={banner.url}
							target="_blank"
							rel="noopener noreferrer"
							onClick={() =>
								trackWebengageEvent("Banner Clicked", {
									"Banner Name":
										banner.title?.trim() ||
										banner.alt?.trim() ||
										"Banner",
									"Banner ID": banner._id,
									Image: banner.imageUrl,
								})
							}
						>
							<img
								src={imageUrl}
								srcSet={imageSrcSet}
								sizes="(min-width: 1024px) 70vw, 100vw"
								alt={banner.alt || "Banner"}
								loading={index === 0 ? "eager" : "lazy"}
								fetchPriority={index === 0 ? "high" : "auto"}
								decoding="async"
								className="block h-auto w-full"
							/>
						</a>
					</SwiperSlide>
				);
			})}
		</Swiper>
	);
};

export default BannerCarousel;
