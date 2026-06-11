import { useLocation } from "@tanstack/react-router";
import {
	createContext,
	type PropsWithChildren,
	useContext,
	useEffect,
	useState,
} from "react";

export type Tabs =
	| "scores"
	| "favourites"
	| "news"
	| "betting"
	| "videos"
	| "Play lottery"
	| "games"
	| "match-scores";

type ActiveTabContextType = {
	tab: Tabs;
	setTab: (tab: Tabs) => void;
};
const ActiveTabContext = createContext<ActiveTabContextType | undefined>(
	undefined,
);

export const ActiveTabProvider = ({ children }: PropsWithChildren) => {
	const [tab, setTab] = useState<Tabs>("scores");
	const location = useLocation();

	useEffect(() => {
		const path = location.pathname;
		const searchStr = location.search;
		const params = new URLSearchParams(searchStr);
		const tabParam = params.get("tab");

		if (path.startsWith("/favorites")) {
			setTab("favourites");
		} else if (path.startsWith("/videos")) {
			setTab("videos");
		} else if (path.startsWith("/news")) {
			setTab("news");
		} else if (path.startsWith("/betting") || path.startsWith("/sportsbook")) {
			setTab("betting");
		} else if (path.startsWith("/games")) {
			setTab("games");
		} else if (path.includes("/matches")) {
			setTab("match-scores");
		} else {
			setTab("scores");
		}
	}, [location.pathname, location.search]);

	return (
		<ActiveTabContext.Provider value={{ tab, setTab }}>
			{children}
		</ActiveTabContext.Provider>
	);
};

export const useActiveTab = () => {
	const activeTabContext = useContext(ActiveTabContext);

	if (!activeTabContext) {
		throw new Error("useActiveTab must be inside ActiveTabProvider");
	}

	return activeTabContext;
};
