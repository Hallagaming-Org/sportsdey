import { createFileRoute } from "@tanstack/react-router";
import { TournamentsPage } from "@/components/tournaments-section/TournamentsPage";

export const Route = createFileRoute("/tournaments/")({
	head: () => ({
		meta: [{ title: "Tournaments | sportsdey" }],
	}),
	component: TournamentsPage,
});
