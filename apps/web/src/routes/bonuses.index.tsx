import { createFileRoute } from "@tanstack/react-router";
import { BonusesPage } from "@/components/bonuses-section/BonusesPage";

export const Route = createFileRoute("/bonuses/")({
	component: BonusesPage,
});
