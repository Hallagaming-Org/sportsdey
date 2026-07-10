import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import Loader from "@/components/loader";
import { useSession } from "@/lib/auth/client";
import {
	loginWebengageUser,
	setWebengageUserAttributes,
} from "@/lib/webengage";

export const Route = createFileRoute("/auth/callback")({
	validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
		returnTo: search.returnTo as string | undefined,
	}),
	component: AuthCallback,
});

function AuthCallback() {
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
			we_email: session.user.email || "",
			we_first_name: nameParts[0] || "",
			we_last_name: nameParts.slice(1).join(" ") || "",
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
