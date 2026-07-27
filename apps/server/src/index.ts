import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { createAuth, createHashCookie, getAuthCookiePolicy } from "./auth";
import {
	CORS_ALLOW_HEADERS,
	CORS_ALLOW_METHODS,
	getAllowedCorsOrigins,
} from "./constants/cors";
import {
	SECURE_SESSION_COOKIE_NAME,
	SESSION_COOKIE_NAME,
} from "./constants/session";
import adminRoute from "./routes/admin";
import adminCmsRoute from "./routes/admin-cms";
import adminLogNotesRoute from "./routes/admin-log-notes";
import adminNotificationsRoute from "./routes/admin-notifications";
import adminOverviewRoute from "./routes/admin-overview";
import adminTicketOverviewRoute from "./routes/admin-ticket-overview";
import adminTicketsRoute from "./routes/admin-tickets";
import adminTransactionsRoute from "./routes/admin-transactions";
import adminWithdrawalsRoute from "./routes/admin-withdrawals";
import cmsRoute from "./routes/cms";
import routes from "./routes/route";
import type { CloudflareBindings } from "./types";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function getAuth(env: CloudflareBindings) {
	return createAuth(env);
}

app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
	type: "http",
	scheme: "bearer",
	description:
		"Enter the session token from /auth/sign-in/email or /auth/sign-in/oauth",
});

app.use("*", async (c, next) => {
	if (c.req.method === "OPTIONS") {
		const origin = c.req.header("origin") || "";
		const allowedOrigins = getAllowedCorsOrigins(c.env.CORS_ORIGIN);

		if (allowedOrigins.has(origin)) {
			return c.text("", 204 as ContentfulStatusCode, {
				"Access-Control-Allow-Origin": origin,
				"Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
				"Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
				"Access-Control-Allow-Credentials": "true",
			});
		}
		return c.text("", 204 as ContentfulStatusCode);
	}
	await next();
});

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin, c) => {
			if (!origin) return "";
			const allowedOrigins = getAllowedCorsOrigins(c?.env?.CORS_ORIGIN);
			return allowedOrigins.has(origin) ? origin : "";
		},
		allowMethods: ["GET", "POST", "PATCH", "OPTIONS", "DELETE"],
			allowHeaders: ["Authorization", "Content-Type", "X-WebEngage-Secret"],
		credentials: true,
	}),
);

app.on(["GET", "POST"], "/auth/*", async (c) => {
	const auth = getAuth(c.env);
	const response = await auth.handler(c.req.raw);

	const setCookies: string[] = [];
	response.headers.forEach((value, key) => {
		if (key.toLowerCase() === "set-cookie") {
			setCookies.push(value);
		}
	});

	const tokenCookie = setCookies.find(
		(cookie) =>
			cookie.startsWith(`${SECURE_SESSION_COOKIE_NAME}=`) ||
			cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
	);
	if (tokenCookie) {
		const match = tokenCookie.match(/=([^;]+)/);
		const token = match?.[1];
		if (token) {
			const hashCookie = createHashCookie(
				token,
				c.env.NODE_ENV,
				c.env.BETTER_AUTH_URL,
			);
			response.headers.append("Set-Cookie", hashCookie);
		} else {
			const policy = getAuthCookiePolicy({
				nodeEnv: c.env.NODE_ENV,
				authUrl: c.env.BETTER_AUTH_URL,
			});
			const secureFlag = policy.useSecureCookies ? "; Secure" : "";
			const actualPrefix = tokenCookie.startsWith("__Secure-")
				? "__Secure-ba"
				: "ba";
			response.headers.append(
				"Set-Cookie",
				`${actualPrefix}.session_token_hash=; Path=/; HttpOnly; SameSite=${policy.sameSite === "none" ? "None" : "Lax"}${secureFlag}; Max-Age=0`,
			);
		}
	}

	return response;
});

app.use("*", async (c, next) => {
	const path = c.req.path;
	if (
		path.startsWith("/auth/") ||
		path.startsWith("/docs") ||
		path.startsWith("/openapi") ||
		path.startsWith("/api/account/") ||
		path.startsWith("/account/") ||
		path.startsWith("/scorpio/callback") ||
		path.startsWith("/api/scorpio/callback") ||
		path.startsWith("/webhooks/") ||
		path.startsWith("/admin")
	) {
		return next();
	}
	const auth = getAuth(c.env);
	const sessionResult = await auth.api.getSession({
		headers: c.req.raw.headers,
	});
	c.set("session", sessionResult?.session ?? null);
	c.set("user", sessionResult?.user ?? null);
	await next();
});

app.route("/", routes);
app.route("/admin", adminRoute);
app.route("/admin", adminWithdrawalsRoute);
app.route("/admin", adminTransactionsRoute);
app.route("/admin", adminTicketsRoute);
app.route("/admin", adminTicketOverviewRoute);
app.route("/admin", adminLogNotesRoute);
app.route("/admin", adminNotificationsRoute);
app.route("/admin", adminOverviewRoute);
app.route("/cms", adminCmsRoute);
app.route("/cms", cmsRoute);

app.get("/docs", swaggerUI({ url: "/openapi.json" }));
app.doc("/openapi.json", {
	openapi: "3.0.0",
	info: {
		version: "1.0.0",
		title: "SportsDey API",
		description: "API for the sportsdey website",
	},
});

export default app;