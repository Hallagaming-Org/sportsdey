import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/news")({
	validateSearch: z.object({
		tab: z.enum(["news", "videos"]).optional(),
		category: z.string().optional(),
	}),
	component: NewsLayout,
});

function NewsLayout() {
	return <Outlet />;
}
