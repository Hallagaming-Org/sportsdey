import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import Loader from "@/components/loader";
import { useSession } from "@/lib/auth/client";
import {
	loginWebengageUser,
	setWebengageSdkUserProfile,
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
		setWebengageSdkUserProfile({
			email: session.user.email || "",
			firstName: nameParts[0] || "",
			lastName: nameParts.slice(1).join(" ") || "",
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
