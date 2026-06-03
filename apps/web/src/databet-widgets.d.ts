import type * as React from "react";

declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			"top-events-outside-widget": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement>,
				HTMLElement
			> & {
				"sport-type"?: "sports" | "esports" | "all";
				"with-sport-title"?: boolean;
				style?: React.CSSProperties;
				className?: string;
			};
			"island-betslip-widget": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement>,
				HTMLElement
			> & {
				style?: React.CSSProperties;
				className?: string;
			};
		}
	}
}
