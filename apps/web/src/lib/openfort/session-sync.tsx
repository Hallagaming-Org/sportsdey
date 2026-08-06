import { useSignOut, useUser } from "@openfort/react";
import { useCallback, useEffect, useRef } from "react";
import { useSession } from "@/lib/auth/client";

/**
 * Keeps Openfort's third-party session in sync with Sportsdey Better Auth.
 */
export function OpenfortSessionSync() {
	const { getAccessToken } = useUser();
	const { signOut } = useSignOut();
	const { data: session, isPending } = useSession();
	const hasUser = Boolean(session?.user);
	const sessionToken = session?.session?.token;
	const hadSessionRef = useRef(false);

	const getAccessTokenRef = useRef(getAccessToken);
	getAccessTokenRef.current = getAccessToken;
	const signOutRef = useRef(signOut);
	signOutRef.current = signOut;

	const syncSession = useCallback(() => {
		void getAccessTokenRef.current().catch((error) => {
			console.error("Openfort: failed to sync Better Auth session", error);
		});
	}, []);

	useEffect(() => {
		if (isPending) return;

		if (hasUser && sessionToken) {
			hadSessionRef.current = true;
			syncSession();
			return;
		}

		if (hadSessionRef.current) {
			hadSessionRef.current = false;
			void signOutRef.current();
		}
	}, [hasUser, isPending, sessionToken, syncSession]);

	return null;
}
