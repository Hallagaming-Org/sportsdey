import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth/client";
import {
	loginWebengageUser,
	setWebengageUserAttributes,
} from "@/lib/webengage";
import Loader from "@/components/loader";

export const Route = createFileRoute("/webengage/oauth-callback")({
	validateSearch: (
		search: Record<string, unknown>,
	): { returnTo?: string } => ({
		returnTo: search.returnTo as string | undefined,
	}),
	component: WebengageCallback,
});

function WebengageCallback() {
	const { returnTo } = Route.useSearch();
	const navigate = useNavigate();
	const { data: session } = useSession();
	const tracked = useRef(false);

	useEffect(() => {
		if (tracked.current) return;
		if (!session?.user?.id) return;
		tracked.current = true;

		loginWebengageUser(session.user.id);

		const nameParts = (session.user.name || "").trim().split(/\s+/);
		setWebengageUserAttributes({
			email: session.user.email || "",
			"first name": nameParts[0] || "",
			"last name": nameParts.slice(1).join(" ") || "",
		});

		navigate({ to: returnTo || "/" });
	}, [session]);

	useEffect(() => {
		const timeout = setTimeout(() => {
			if (!tracked.current) {
				navigate({ to: returnTo || "/" });
			}
		}, 5000);
		return () => clearTimeout(timeout);
	}, []);

	return <Loader />;
}
