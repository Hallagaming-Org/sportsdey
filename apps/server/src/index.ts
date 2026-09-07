import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
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
import adminActivityRoute from "./routes/admin-activity";
import adminCmsRoute from "./routes/admin-cms";
import adminExportsRoute from "./routes/admin-exports";
import adminLogNotesRoute from "./routes/admin-log-notes";
import adminNotificationsRoute from "./routes/admin-notifications";
import adminOverviewRoute from "./routes/admin-overview";
import adminPromotionsRoute from "./routes/admin-promotions";
import adminTicketOverviewRoute from "./routes/admin-ticket-overview";
import adminTicketsRoute from "./routes/admin-tickets";
import adminTransactionsRoute from "./routes/admin-transactions";
import adminWithdrawalsRoute from "./routes/admin-withdrawals";
import cmsRoute from "./routes/cms";
import routes from "./routes/route";
import type { CloudflareBindings } from "./types";
import type { ExportQueueMessage } from "./types/exports";
import {
	deleteExpiredExports,
	processExportMessage,
	requeueStaleChunks,
} from "./utils/exports/service";
import { extractBearerToken }  from "./utils/webengage-sms-auth";
import { isD1CapacityError } from "./utils/d1-errors";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.onError((err, c) => {
	console.error("Unhandled error:", err.message, err.stack);
	if (isD1CapacityError(err)) {
		return c.json(
			{
				success: false as const,
				error: "Service temporarily unavailable. Please try again shortly.",
			},
			503,
		);
	}
	return c.json(
		{
			error: {
				code: "internal_error",
				data: { message: "Internal server error" },
			},
		},
		500,
	);
});

const authCache: ReturnType<typeof createAuth> | null = null;

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

// app.use("*", async (c, next) => {
// 	if (c.req.method === "OPTIONS") {
// 		const origin = c.req.header("origin") || "";
// 		const allowedOrigins = getAllowedCorsOrigins(c.env.CORS_ORIGIN);

// 		if (allowedOrigins.has(origin)) {
// 			return c.body(null, 204, {
// 				"Access-Control-Allow-Origin": origin,
// 				"Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
// 				"Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
// 				"Access-Control-Allow-Credentials": "true",
// 			});
// 		}
// 		return c.body(null, 204);
// 	}
// 	await next();
// });

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin, c) => {
			if (!origin) return "";
			const allowedOrigins = getAllowedCorsOrigins(c?.env?.CORS_ORIGIN);
			return allowedOrigins.has(origin) ? origin : "";
		},
		allowMethods: CORS_ALLOW_METHODS,
		allowHeaders: CORS_ALLOW_HEADERS,
		exposeHeaders: ["set-auth-token"],
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
				`${actualPrefix}.session_token_hash=; Path=/; HttpOnly; Domain=.sportsdey.com; SameSite=${policy.sameSite === "none" ? "None" : "Lax"}${secureFlag}; Max-Age=0`,
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
		path.startsWith("/admin") ||
		path.startsWith("/bonus-engine/callback/") ||
		path.startsWith("/gamification/callback/") ||
		path.startsWith("/bem/api/BonusEngine/") ||
		path.startsWith("/opay/callback") ||
		path.startsWith("/kuda/webhook") ||
		path.startsWith("/palmpay/webhook") ||
		// Public server-to-server SSO exchange — authorized by code + token, not a session.
		path.startsWith("/public/handoff/exchange")
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
app.route("/admin", adminExportsRoute);
app.route("/admin", adminTransactionsRoute);
app.route("/admin", adminTicketsRoute);
app.route("/admin", adminTicketOverviewRoute);
app.route("/admin", adminPromotionsRoute);
app.route("/admin", adminLogNotesRoute);
app.route("/admin", adminNotificationsRoute);
app.route("/admin", adminActivityRoute);
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

export default {
	fetch: app.fetch,
	async queue(
		batch: {
			messages: ReadonlyArray<{
				body: ExportQueueMessage;
				attempts: number;
				retry(options?: { delaySeconds?: number }): void;
			}>;
		},
		env: CloudflareBindings,
	) {
		for (const message of batch.messages) {
			const result = await processExportMessage(
				env,
				message.body,
				message.attempts,
			);
			if (result === "retry")
				message.retry({
					delaySeconds: Math.min(300, 2 ** message.attempts * 10),
				});
		}
	},
	async scheduled(_controller: unknown, env: CloudflareBindings) {
		await requeueStaleChunks(env);
		await deleteExpiredExports(env);
	},
};
