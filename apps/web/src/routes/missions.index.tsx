import { createFileRoute } from "@tanstack/react-router";
import { MissionsPage } from "@/components/missions-section/MissionsPage";

export const Route = createFileRoute("/missions/")({
	component: MissionsPage,
});
