import { defineField, defineType } from "sanity";

export const promoType = defineType({
    name: "promo",
    title: "Promo",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Promo Title",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "bannerImages",
            title: "Banner Images",
            type: "array",
            of: [
                {
                    type: "image",
                    options: { hotspot: true },
                    fields: [
                        {
                            name: "alt",
                            title: "Alt Text",
                            type: "string",
                            options: { isHighlighted: true },
                        },
                    ],
                },
            ],
        }),
        defineField({
            name: "endDate",
            title: "End Date",
            type: "datetime",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "body",
            title: "Body",
            type: "array",
            of: [{ type: "block" }],
        }),
        defineField({
            name: "type",
            title: "Type",
            type: "string",
            options: {
                list: [
                    { title: "SportsDey Exclusive", value: "sportsdey-exclusive" },
                    { title: "Casino", value: "casino" },
                    { title: "Sport", value: "sport" },
                ],
            },
            validation: (rule) => rule.required(),
        }),
    ],
});
