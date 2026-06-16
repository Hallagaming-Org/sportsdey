import { createStartHandler } from "@tanstack/react-start/cloudflare";
import { getRouter } from "./router";

// Cloudflare Worker entrypoint for TanStack React Start SSR.
// Wrangles fetch requests through the generated router and server functions.
export default createStartHandler({
	createRouter: getRouter,
});
