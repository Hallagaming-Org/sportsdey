import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";

const signInSearchSchema = z.object({
	returnTo: z.string().optional().catch(""),
	mode: z.enum(["login", "signup"]).optional().catch("login"),
});

export const Route = createFileRoute("/auth/sign-in")({
	validateSearch: signInSearchSchema,
	beforeLoad: ({ search }) => {
		throw redirect({
			to: "/auth/phone-sign-in",
			replace: true,
			search: {
				mode: search.mode === "signup" ? "signup" : "login",
				returnTo: search.returnTo || undefined,
			},
		});
	},
	component: () => null,
});
