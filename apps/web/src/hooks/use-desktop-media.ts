import { useEffect, useState } from "react";

const DESKTOP_MQ = "(min-width: 1024px)";

/** Client-only desktop flag. SSR and first paint stay false to keep mobile JS light. */
export function useDesktopMedia(): boolean {
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia(DESKTOP_MQ);
		const apply = () => setIsDesktop(mq.matches);
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, []);

	return isDesktop;
}
