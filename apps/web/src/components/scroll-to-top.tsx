import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export function ScrollToTop() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const searchStr = useRouterState({ select: (s) => s.location.searchStr });
	const href = useRouterState({ select: (s) => s.location.href });
	const isFirstMount = useRef(true);

	useEffect(() => {
		if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}
	}, []);

	useEffect(() => {
		if (isFirstMount.current) {
			isFirstMount.current = false;
			return;
		}

		let animationFrameId: number | null = null;

		const smoothScroll = (duration = 650) => {
			const targetElements: HTMLElement[] = [];
			const mains = document.querySelectorAll<HTMLElement>("main, [id='app-main-content']");
			mains.forEach((el) => targetElements.push(el));

			const scrollables = document.querySelectorAll<HTMLElement>(
				".overflow-y-auto, .overflow-auto, [data-scroll-container]",
			);
			scrollables.forEach((el) => {
				if (el.tagName.toLowerCase() !== "aside" && !targetElements.includes(el)) {
					targetElements.push(el);
				}
			});

			const docEl = document.documentElement;
			const bodyEl = document.body;
			if (docEl && !targetElements.includes(docEl)) targetElements.push(docEl);
			if (bodyEl && !targetElements.includes(bodyEl)) targetElements.push(bodyEl);

			const startPositions = targetElements.map((el) => el.scrollTop);
			const windowStart = window.scrollY;

			const maxScroll = Math.max(...startPositions, windowStart);
			if (maxScroll <= 0) return;

			const startTime = performance.now();

			// Smooth ease-out cubic animation
			const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

			const step = (currentTime: number) => {
				const elapsed = currentTime - startTime;
				const progress = Math.min(elapsed / duration, 1);
				const ease = easeOutCubic(progress);

				targetElements.forEach((el, i) => {
					const start = startPositions[i];
					if (start && start > 0) {
						el.scrollTop = Math.round(start * (1 - ease));
					}
				});

				if (windowStart > 0) {
					window.scrollTo({ top: Math.round(windowStart * (1 - ease)), behavior: "auto" });
				}

				if (progress < 1) {
					animationFrameId = requestAnimationFrame(step);
				}
			};

			animationFrameId = requestAnimationFrame(step);
		};

		smoothScroll(650);

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	}, [pathname, searchStr, href]);

	return null;
}
