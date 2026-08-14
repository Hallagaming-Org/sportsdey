import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

export function ScrollToTop() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const searchStr = useRouterState({ select: (s) => s.location.searchStr });
	const href = useRouterState({ select: (s) => s.location.href });

	useEffect(() => {
		if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}
	}, []);

	useEffect(() => {
		const performScroll = () => {
			window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
			document.documentElement.scrollTop = 0;
			document.body.scrollTop = 0;

			const mains = document.querySelectorAll("main, [id='app-main-content']");
			mains.forEach((el) => {
				el.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
				el.scrollTop = 0;
			});

			const scrollables = document.querySelectorAll(
				".overflow-y-auto, .overflow-auto, [data-scroll-container]",
			);
			scrollables.forEach((el) => {
				// Don't scroll sidebar if it's the aside menu
				if (el.tagName.toLowerCase() !== "aside") {
					el.scrollTop = 0;
				}
			});
		};

		performScroll();

		const frame1 = requestAnimationFrame(performScroll);
		const frame2 = requestAnimationFrame(() => requestAnimationFrame(performScroll));
		const t1 = setTimeout(performScroll, 30);
		const t2 = setTimeout(performScroll, 100);
		const t3 = setTimeout(performScroll, 250);

		return () => {
			cancelAnimationFrame(frame1);
			cancelAnimationFrame(frame2);
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
	}, [pathname, searchStr, href]);

	return null;
}
