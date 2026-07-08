import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/webengage/oauth-callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const returnTo = url.searchParams.get("returnTo");

				const serverURL = import.meta.env.VITE_SERVER_URL;

				const cookie = request.headers.get("cookie") || "";

				const sessionRes = await fetch(`${serverURL}auth/get-session`, {
					headers: {
						cookie,
					},
				});

				if (sessionRes.ok) {
					const sessionData = await sessionRes.json();
					const user = sessionData?.user;

					if (user?.id) {
						const nameParts = (user.name || "").trim().split(/\s+/);

						fetch(`${serverURL}webengage/track-user`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								userId: user.id,
								email: user.email || "",
								firstName: nameParts[0] || "",
								lastName: nameParts.slice(1).join(" ") || "",
							}),
						}).catch((e) => console.error("WebEngage error:", e));
					}
				}

				const responseHeaders = new Headers();
				responseHeaders.set("location", returnTo || "/");

				const setCookies: string[] = [];
				sessionRes.headers.forEach((value, key) => {
					if (key.toLowerCase() === "set-cookie") {
						setCookies.push(value);
					}
				});
				for (const cookie of setCookies) {
					responseHeaders.append("Set-Cookie", cookie);
				}

				return new Response(null, {
					status: 302,
					headers: responseHeaders,
				});
			},
		},
	},
});
