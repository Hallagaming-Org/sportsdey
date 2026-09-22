import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SPORTSBOOK_PREMATCH_SPLAT } from "@/lib/sportsbook";

export const Route = createFileRoute("/sportsbetting")({
	beforeLoad: ({ location }) => {
		const pathname = location.pathname.replace(/\/+$/, "") || "/";
		if (pathname === "/sportsbetting") {
			throw redirect({
				to: "/sportsbetting/$",
				params: { _splat: SPORTSBOOK_PREMATCH_SPLAT },
				search: {},
				replace: true,
			});
		}
	},
	component: () => <Outlet />,
});
