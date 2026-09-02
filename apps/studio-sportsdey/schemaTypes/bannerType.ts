import { defineField, defineType } from "sanity";

export const bannerType = defineType({
	name: "banner",
	title: "Banner",
	type: "document",
	fields: [
		defineField({
			name: "image",
			title: "Banner Image",
			type: "image",
			options: {
				hotspot: true,
			},
			fields: [
				{
					name: "alt",
					title: "Alt Text",
					type: "string",
					options: {
						isHighlighted: true,
					},
				},
			],
		}),
		defineField({
			name: "title",
			title: "Banner Name",
			type: "string",
			description: "Shown as Banner Name in analytics. Do not use the image filename.",
		}),
		defineField({
			name: "url",
			title: "Link URL",
			type: "url",
			validation: (rule) =>
				rule.uri({
					scheme: ["http", "https"],
				}),
		}),
	],
});
