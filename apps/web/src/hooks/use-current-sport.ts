import { useRouterState } from "@tanstack/react-router";
import { SPORTS, type Sport } from "@/lib/constants";

const STORAGE_KEY = "sportsdey-current-sport";

export const useCurrentSport = (): Sport => {
	const { location } = useRouterState();
	const pathname = location.pathname;
	const searchSport = location.search?.sports as Sport | undefined;

	if (searchSport && Object.values(SPORTS).includes(searchSport)) {
		if (typeof window !== "undefined") {
			localStorage.setItem(STORAGE_KEY, searchSport);
		}
		return searchSport;
	}

	if (pathname.startsWith("/tennis")) {
		persist(SPORTS.TENNIS);
		return SPORTS.TENNIS;
	}

	if (pathname.startsWith("/basketball")) {
		persist(SPORTS.BASKETBALL);
		return SPORTS.BASKETBALL;
	}

	if (pathname.startsWith("/boxing")) {
		persist(SPORTS.BOXING);
		return SPORTS.BOXING;
	}

	if (pathname.startsWith("/ufc")) {
		persist(SPORTS.UFC);
		return SPORTS.UFC;
	}

	if (pathname === "/" || pathname.startsWith("/football")) {
		persist(SPORTS.FOOTBALL);
		return SPORTS.FOOTBALL;
	}

	if (typeof window !== "undefined") {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (Object.values(SPORTS).includes(saved as Sport)) {
			return saved as Sport;
		}
	}

	return SPORTS.FOOTBALL;
};

const persist = (sport: Sport) => {
	if (typeof window !== "undefined") {
		localStorage.setItem("sportsdey-current-sport", sport);
	}
};
