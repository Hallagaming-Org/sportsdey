import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { matchWebengageAttrs, trackWebengageEvent } from "@/lib/webengage";

export interface FavoriteTeam {
	id: string; // Unique identifier (name if id is missing, or specific id)
	name: string;
	logo?: string;
	sport: string;
	tournament?: string;
	tournamentId?: string;
	country?: string;
	flag?: string;
}

export interface FavoriteMatch {
	id: string;
	team1: string;
	team2: string;
	date?: string;
	time?: string;
	sport: string;
	tournament?: string;
	country?: string;
	flag?: string;
}

export interface FavoriteLeague {
	id: string;
	name: string;
	country: string;
	flag?: string;
	sport: string;
}

// Custom event for cross-component synchronization within the same window
const FAVORITES_UPDATED_EVENT = "favorites-updated";

const isBrowser = typeof window !== "undefined";

function getStorageItem<T>(key: string, initialValue: T): T {
	if (!isBrowser) return initialValue;
	try {
		const item = window.localStorage.getItem(key);
		return item ? JSON.parse(item) : initialValue;
	} catch {
		// Silently return initial value on error
		return initialValue;
	}
}

function setStorageItem<T>(key: string, value: T) {
	if (!isBrowser) return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
		window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
	} catch {
		// Silently fail on localStorage error
	}
}

export const useFavorites = () => {
	const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>(
		() => getStorageItem("basketball_favorites", []), // Keeping 'basketball_favorites' key for now for backward compat, but we might want to migrate or generalize
	);
	const [favoriteMatches, setFavoriteMatches] = useState<FavoriteMatch[]>(() =>
		getStorageItem("favorite_matches", []),
	);
	const [favoriteLeagues, setFavoriteLeagues] = useState<FavoriteLeague[]>(() =>
		getStorageItem("favorite_leagues", []),
	);

	const refreshFavorites = useCallback(() => {
		setFavoriteTeams(getStorageItem("basketball_favorites", []));
		setFavoriteMatches(getStorageItem("favorite_matches", []));
		setFavoriteLeagues(getStorageItem("favorite_leagues", []));
	}, []);

	useEffect(() => {
		if (!isBrowser) return;
		window.addEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
		// Also listen to storage events for cross-tab sync
		window.addEventListener("storage", refreshFavorites);

		return () => {
			window.removeEventListener(FAVORITES_UPDATED_EVENT, refreshFavorites);
			window.removeEventListener("storage", refreshFavorites);
		};
	}, [refreshFavorites]);

	const toggleFavoriteTeam = (team: FavoriteTeam) => {
		const exists = favoriteTeams.some((t) => t.id === team.id);
		let newFavorites;
		if (exists) {
			newFavorites = favoriteTeams.filter((t) => t.id !== team.id);
			toast.info(`Removed ${team.name} from favorites`);
		} else {
			newFavorites = [...favoriteTeams, team];
			toast.success(`Added ${team.name} to favorites`);
		}
		setFavoriteTeams(newFavorites);
		setStorageItem("basketball_favorites", newFavorites);
	};

	const toggleFavoriteMatch = (match: FavoriteMatch) => {
		const exists = favoriteMatches.some((m) => m.id === match.id);
		let newFavorites;
		if (exists) {
			newFavorites = favoriteMatches.filter((m) => m.id !== match.id);
			toast.info("Removed match from favorites");
			trackWebengageEvent(
				"Match Removed from Favourite",
				matchWebengageAttrs({
					match_id: match.id,
					sport: match.sport,
					league: match.tournament,
					teams: `${match.team1} vs ${match.team2}`,
					timings: match.date || match.time,
					match_status: "",
				}),
			);
		} else {
			newFavorites = [...favoriteMatches, match];
			toast.success("Added match to favorites");
			trackWebengageEvent(
				"Match Added to Favourite",
				matchWebengageAttrs({
					match_id: match.id,
					sport: match.sport,
					league: match.tournament,
					teams: `${match.team1} vs ${match.team2}`,
					timings: match.date || match.time,
					match_status: "",
				}),
			);
		}
		setFavoriteMatches(newFavorites);
		setStorageItem("favorite_matches", newFavorites);
	};

	const toggleFavoriteLeague = (league: FavoriteLeague) => {
		const exists = favoriteLeagues.some((l) => l.id === league.id);
		let newFavorites;
		if (exists) {
			newFavorites = favoriteLeagues.filter((l) => l.id !== league.id);
			toast.info(`Removed ${league.name} from favorites`);
		} else {
			newFavorites = [...favoriteLeagues, league];
			toast.success(`Added ${league.name} to favorites`);
		}
		setFavoriteLeagues(newFavorites);
		setStorageItem("favorite_leagues", newFavorites);
	};

	const isFavoriteTeam = (id: string) => favoriteTeams.some((t) => t.id === id);
	const isFavoriteMatch = (id: string) =>
		favoriteMatches.some((m) => m.id === id);
	const isFavoriteLeague = (id: string) =>
		favoriteLeagues.some((l) => l.id === id);

	return {
		favoriteTeams,
		favoriteMatches,
		favoriteLeagues,
		toggleFavoriteTeam,
		toggleFavoriteMatch,
		toggleFavoriteLeague,
		isFavoriteTeam,
		isFavoriteMatch,
		isFavoriteLeague,
		totalFavoritesCount:
			favoriteTeams.length + favoriteMatches.length + favoriteLeagues.length,
	};
};
