import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import type { BannerData } from "@/lib/banners-server";

interface BannerCarouselProps {
	banners: BannerData[];
}

const BannerCarousel = ({ banners }: BannerCarouselProps) => {
	if (banners.length === 0) return null;

	return (
		<Swiper
			modules={[Autoplay, Pagination]}
			autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }}
			pagination={{ clickable: true }}
			loop={banners.length > 1}
			className="w-full rounded-xl"
		>
			{banners.map((banner) => (
				<SwiperSlide key={banner._id}>
					<a href={banner.url} target="_blank" rel="noopener noreferrer">
						<img
							src={banner.imageUrl}
							alt={banner.alt || "Banner"}
							className="w-full h-auto block"
						/>
					</a>
				</SwiperSlide>
			))}
		</Swiper>
	);
};

export default BannerCarousel;