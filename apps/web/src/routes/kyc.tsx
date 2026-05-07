import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/kyc")({
	component: KycLayout,
});

function KycLayout() {
	return <Outlet />;
}
