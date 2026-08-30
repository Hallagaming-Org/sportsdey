import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import type { BannerData } from "@/lib/banners-server";
import { trackWebengageEvent } from "@/lib/webengage";

interface BannerCarouselProps {
	banners: BannerData[];
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
			{banners.map((banner) => {
				// The backend sometimes returns Sanity URLs with ?rect=...&w=...&h=... which crops the image.
				// We strip everything after the '?' to force Sanity to load the original, full uncropped image!
				const originalImageUrl = banner.imageUrl.split("?")[0];

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
								src={originalImageUrl}
								alt={banner.alt || "Banner"}
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
