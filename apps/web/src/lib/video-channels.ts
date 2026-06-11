export const CATEGORY_CHANNELS: Record<string, string[]> = {
  football: [
    "Sky Sports Football",
    "TNT Sports",
    "Premier League",
    "ESPN FC",
    "433",
    "CBS Sports Golazo",
    "Serie A",
    "LaLiga",
    "Bundesliga",
    "UEFA",
  ],
  basketball: [
    "House of Highlights",
    "NBA",
    "Ballislife",
    "FreeDawkins",
    "ESPN NBA",
    "Bleacher Report",
  ],
  tennis: [
    "ATP Tour",
    "WTA",
    "Tennis TV",
    "Wimbledon",
    "Roland-Garros",
    "US Open Tennis Championships",
    "Australian Open TV",
  ],
  boxing: [
    "Top Rank Boxing",
    "Matchroom Boxing",
    "DAZN Boxing",
    "Premier Boxing Champions",
    "Queensberry Promotions",
    "Golden Boy Boxing",
  ],
  ufc: [
    "UFC",
    "MMA Fighting",
    "TNT Sports UFC",
    "ONE Championship",
    "Bellator MMA",
    "PFL MMA",
    "MMA Junkie",
  ],
  mma: [
    "UFC",
    "MMA Fighting",
    "TNT Sports UFC",
    "ONE Championship",
    "Bellator MMA",
    "PFL MMA",
    "MMA Junkie",
  ],
  all: [
    "House of Highlights",
    "NBA",
    "Premier League",
    "TNT Sports",
    "Tennis TV",
    "ATP Tour",
    "DAZN Boxing",
    "Top Rank Boxing",
    "UFC",
    "ONE Championship",
  ],
};

export function buildVideoQuery(category: string): string {
  const channels = CATEGORY_CHANNELS[category];
  if (!channels) return category;
  return `${channels.join(" ")} ${category}`;
}
