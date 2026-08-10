declare global {
	interface Window {
		webengage?: {
			init: (licenseKey: string) => void;
			track: (name: string, attributes?: Record<string, unknown>) => void;
			user: {
				login: (userId: string) => void;
				logout: () => void;
				setAttribute: (attribute: string, value: unknown) => void;
			};
		};
	}
}

const Webengage = () => {
	if (typeof window === "undefined" || !window.webengage) return null;
	return window.webengage;
};

export function loginWebengageUser(userId: string) {
	Webengage()?.user.login(userId);
}

export function logoutWebengageUser() {
	Webengage()?.user.logout();
}

export function setWebengageUserAttribute(attribute: string, value: unknown) {
	Webengage()?.user.setAttribute(attribute, value);
}

export function setWebengageUserAttributes(attributes: Record<string, unknown>) {
	const we = Webengage();
	if (!we) return;
	for (const [key, value] of Object.entries(attributes)) {
		we.user.setAttribute(key, value);
	}
}

export function trackWebengageEvent(
	eventName: string,
	attributes?: Record<string, unknown>,
) {
	Webengage()?.track(eventName, attributes);
}
