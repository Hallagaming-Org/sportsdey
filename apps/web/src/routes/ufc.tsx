import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/ufc")({
	component: () => <Outlet />,
});
