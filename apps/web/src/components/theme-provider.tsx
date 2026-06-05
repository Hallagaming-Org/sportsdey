import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
	children,
	...props
}: {
	children: React.ReactNode;
	attribute?: "class" | "data-theme";
	defaultTheme?: string;
	forcedTheme?: string;
	enableSystem?: boolean;
	disableTransitionOnChange?: boolean;
}) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
