import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
	createAuth,
	createHashCookie,
	extractBearerToken,
	getAuthCookiePolicy,
	isRawSessionBearer,
	withSignedSessionCookie,
	withSignedSessionHeaders,
} from "./auth";
import {
	CORS_ALLOW_HEADERS,
	CORS_ALLOW_METHODS,
	CORS_EXPOSE_HEADERS,
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

type AuthContext = {
	env: CloudflareBindings;
	req: { raw: Request };
};

function getRawBearerToken(request: Request): string | null {
	const bearer = extractBearerToken(request);
	if (bearer && isRawSessionBearer(bearer)) return bearer;
	return null;
}

async function resolveAuthRequest(c: AuthContext) {
	const rawBearer = getRawBearerToken(c.req.raw);
	// Phone OTP returns a raw session token; inject a signed cookie so Better Auth
	// getSession accepts it even when the browser drops cross-origin Set-Cookie.
	if (rawBearer) {
		return withSignedSessionCookie(
			c.req.raw,
			rawBearer,
			c.env.BETTER_AUTH_SECRET,
			{
				nodeEnv: c.env.NODE_ENV,
				authUrl: c.env.BETTER_AUTH_URL,
			},
		);
	}
	return c.req.raw;
}

/** Headers-only auth resolution — safe for middleware that must not consume the body. */
async function resolveAuthHeaders(c: AuthContext) {
	const rawBearer = getRawBearerToken(c.req.raw);
	if (rawBearer) {
		return withSignedSessionHeaders(
			c.req.raw,
			rawBearer,
			c.env.BETTER_AUTH_SECRET,
			{
				nodeEnv: c.env.NODE_ENV,
				authUrl: c.env.BETTER_AUTH_URL,
			},
		);
	}
	return c.req.raw.headers;
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
				"Access-Control-Expose-Headers": CORS_EXPOSE_HEADERS,
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
		allowHeaders: ["Authorization", "Content-Type", "set-auth-token"],
		exposeHeaders: ["set-auth-token", "Set-Auth-Token"],
		credentials: true,
	}),
);

app.on(["GET", "POST"], "/auth/*", async (c) => {
	const auth = getAuth(c.env);
	const request = await resolveAuthRequest(c);
	const response = await auth.handler(request);

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
				c.env.COOKIE_DOMAIN,
				c.env.BETTER_AUTH_URL,
			);
			response.headers.append("Set-Cookie", hashCookie);
		} else {
			const policy = getAuthCookiePolicy({
				nodeEnv: c.env.NODE_ENV,
				authUrl: c.env.BETTER_AUTH_URL,
				cookieDomain: c.env.COOKIE_DOMAIN,
			});
			const secureFlag = policy.useSecureCookies ? "; Secure" : "";
			const domain = policy.cookieDomain
				? `; Domain=${policy.cookieDomain}`
				: "";
			const actualPrefix = tokenCookie.startsWith("__Secure-")
				? "__Secure-ba"
				: "ba";
			response.headers.append(
				"Set-Cookie",
				`${actualPrefix}.session_token_hash=; Path=/${domain}; HttpOnly; SameSite=${policy.sameSite === "none" ? "None" : "Lax"}${secureFlag}; Max-Age=0`,
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
		path.startsWith("/admin")
	) {
		return next();
	}
	const auth = getAuth(c.env);
	// Only mutate headers — never clone the Request here or PATCH/POST JSON bodies
	// become empty ("Malformed JSON in request body").
	const headers = await resolveAuthHeaders(c);
	const sessionResult = await auth.api.getSession({
		headers,
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