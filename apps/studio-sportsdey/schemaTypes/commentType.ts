import { defineField, defineType } from "sanity";

export const commentType = defineType({
	name: "comment",
	title: "Comment",
	type: "document",
	fields: [
		defineField({
			name: "name",
			title: "Commenter Name",
			type: "string",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "email",
			title: "Email",
			type: "string",
			description: "Used for moderation only; not displayed publicly.",
			validation: (rule) => rule.email().optional(),
		}),
		defineField({
			name: "userId",
			title: "User ID",
			type: "string",
			description: "Better Auth user id for traceability.",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "message",
			title: "Message",
			type: "text",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "news",
			title: "News Article",
			type: "reference",
			to: [{ type: "news" }],
			validation: (rule) => rule.required(),
			description: "The news item this comment belongs to.",
		}),
		defineField({
			name: "createdAt",
			title: "Created At",
			type: "datetime",
			initialValue: () => new Date().toISOString(),
			validation: (rule) => rule.required(),
		}),
	],
	orderings: [
		{
			title: "Newest first",
			name: "createdAtDesc",
			by: [{ field: "createdAt", direction: "desc" }],
		},
	],
});
