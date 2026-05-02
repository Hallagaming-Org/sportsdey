import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createAuth } from "./auth";
import adminRoute from "./routes/admin";
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
		]);

		console.log(allowedOrigins.has(origin) ? origin : "");

		if (allowedOrigins.has(origin)) {
			return c.text(null, 204, {
				"Access-Control-Allow-Origin": origin,
				"Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
				"Access-Control-Allow-Headers": "Authorization, Content-Type",
				"Access-Control-Allow-Credentials": "true",
			});
		}
		return c.text(null, 204);
	}
	await next();
});

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin, c) => {
			const corsOrigin = c.env.CORS_ORIGIN || "https://sportsdey.com";
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
			]);
			console.log(allowedOrigins.has(origin) ? origin : "");
			return allowedOrigins.has(origin) ? origin : "";
		},
		allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
		allowHeaders: ["Authorization", "Content-Type"],
		credentials: true,
	}),
);

app.on(["GET", "POST"], "/auth/*", async (c) => {
	const path = c.req.path;
	console.log(
		Object.fromEntries(
			[...c.req.raw.headers.entries()].filter(([k]) =>
				["authorization", "content-type", "origin", "accept"].includes(
					k.toLowerCase(),
				),
			),
		),
	);
	const auth = getAuth(c.env);
	return auth.handler(c.req.raw);
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
	await next();
});

app.route("/", routes);
app.route("/admin", adminRoute);
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
