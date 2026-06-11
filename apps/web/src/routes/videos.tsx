import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/videos")({
	component: VideosLayout,
});

function VideosLayout() {
	return <Outlet />;
}
