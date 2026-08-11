import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createAuth, createHashCookie } from "./auth";
import {
	deleteExpiredExports,
	processExportMessage,
	requeueStaleChunks,
} from "./utils/exports/service";
import type { ExportQueueMessage } from "./types/exports";
import adminRoute from "./routes/admin";
import adminCmsRoute from "./routes/admin-cms";
import adminExportsRoute from "./routes/admin-exports";
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

let authCache: ReturnType<typeof createAuth> | null = null;

function getAuth(env: CloudflareBindings) {
	if (!authCache) {
		authCache = createAuth(env);
	}
	return authCache;
}

app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
	type: "http",
	scheme: "bearer",
	description:
		"Enter the session token from /auth/sign-in/email or /auth/sign-in/oauth",
});

// app.use("*", async (c, next) => {
// 	if (c.req.method === "OPTIONS") {
// 		return c.text("", 204);
// 	}
// 	await next();
// });

app.use("*", async (c, next) => {
	if (c.req.method === "OPTIONS") {
		const origin = c.req.header("origin") || "";
		const corsOrigin = c.env.CORS_ORIGIN || "https://sportsdey.com";
		const allowedOrigins = new Set([
			corsOrigin,
			"http://localhost:3001",
			"http://localhost:3002",
			"http://localhost:8787",
			"sportsdey-mobile://",
			"exp://172.20.10.9:8081",
			"https://admin.sportsdey.com",
			"https://staging-admin.sportsdey.com",
			"https://binary.sportsdey.com",
		]);

		console.log(allowedOrigins.has(origin) ? origin : "");

		if (allowedOrigins.has(origin)) {
			return c.text("", 204, {
				"Access-Control-Allow-Origin": origin,
				"Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS, DELETE",
				"Access-Control-Allow-Headers": "Authorization, Content-Type",
				"Access-Control-Allow-Credentials": "true",
			});
		}
		return c.text("", 204);
	}
	await next();
});

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin, c) => {
			const corsOrigin = c?.env?.CORS_ORIGIN || "https://sportsdey.com";
			console.log("CORS_ORIGIN", corsOrigin);
			if (!origin) return "";
			const allowedOrigins = new Set([
				corsOrigin,
				"http://localhost:3001",
				"http://localhost:3002",
				"http://localhost:8787",
				"sportsdey-mobile://",
				"exp://172.20.10.9:8081",
				"https://admin.sportsdey.com",
				"https://staging-admin.sportsdey.com",
				"https://binary.sportsdey.com",
			]);
			console.log(allowedOrigins.has(origin) ? origin : "");
			return allowedOrigins.has(origin) ? origin : "";
		},
		allowMethods: ["GET", "POST", "PATCH", "OPTIONS", "DELETE"],
		allowHeaders: ["Authorization", "Content-Type"],
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
		(c) =>
			c.startsWith("__Secure-ba.session_token=") ||
			c.startsWith("ba.session_token="),
	);
	if (tokenCookie) {
		const actualPrefix = tokenCookie.startsWith("__Secure-")
			? "__Secure-ba"
			: "ba";
		const match = tokenCookie.match(/=([^;]+)/);
		if (match) {
			const token = match[1];
			console.log("session_token", token);
			if (token) {
				const hashCookie = createHashCookie(token, c.env.NODE_ENV);
				response.headers.append("Set-Cookie", hashCookie);
			} else {
				const secure = c.env.NODE_ENV !== "development";
				const secureFlag = secure ? "; Secure" : "";
				response.headers.append(
					"Set-Cookie",
					`${actualPrefix}.session_token_hash=; Path=/; HttpOnly; SameSite=None${secureFlag}; Domain=.sportsdey.com; Max-Age=0`,
				);
			}
		}
	}

	return response;
});

app.use("*", async (c, next) => {
	console.log("Request to:", c.req.path);
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
	const sessionResult = await auth.api.getSession({
		headers: c.req.raw.headers,
	});
	const session = sessionResult?.session ?? null;
	const user = sessionResult?.user ?? null;
	c.set("session", session);
	c.set("user", user);
	console.log("session", session);
	console.log("user", user);
	await next();
});

app.route("/", routes);
app.route("/admin", adminRoute);
app.route("/admin", adminWithdrawalsRoute);
app.route("/admin", adminExportsRoute);
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
