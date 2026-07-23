const SESSION_TOKEN_KEY = "sportsdey_session_token";

export function getStoredSessionToken(): string | null {
	if (typeof window === "undefined") return null;
	try {
		return (
			window.sessionStorage.getItem(SESSION_TOKEN_KEY) ||
			window.localStorage.getItem(SESSION_TOKEN_KEY)
		);
	} catch {
		return null;
	}
}

export function storeSessionToken(token: string) {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
		window.localStorage.setItem(SESSION_TOKEN_KEY, token);
	} catch {
		// ignore storage failures (private mode, etc.)
	}
}

export function clearStoredSessionToken() {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
		window.localStorage.removeItem(SESSION_TOKEN_KEY);
	} catch {
		// ignore
	}
}
