import { createFileRoute } from "@tanstack/react-router";
import { LoyaltyPage } from "@/components/loyalty-section/LoyaltyPage";

export const Route = createFileRoute("/loyalty/")({
	component: LoyaltyPage,
});
