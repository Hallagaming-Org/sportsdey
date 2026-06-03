import { createFileRoute } from "@tanstack/react-router";
import { getNewsBySlug } from "@/lib/news-server";

const fontUrlBold =
	"https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff";
const fontUrlRegular =
	"https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff";

function escapeXml(unsafe: string): string {
	return unsafe.replace(/[<>&'"]/g, (c) => {
		switch (c) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return c;
		}
	});
}

function wrapText(text: string, maxChars = 50): string[] {
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		if ((currentLine + " " + word).trim().length <= maxChars) {
			currentLine = (currentLine + " " + word).trim();
		} else {
			if (currentLine) lines.push(currentLine);
			currentLine = word;
		}
	}
	if (currentLine) lines.push(currentLine);
	return lines;
}

function truncateText(text: string, maxLength = 200): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength).trim() + "...";
}

export const Route = createFileRoute("/news/$slug/og")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const news = await getNewsBySlug(params.slug);
				if (!news) return new Response("Not Found", { status: 404 });

				let bodyText = "";
				if (Array.isArray(news.body)) {
					const block = news.body.find(
						(b: any) => b._type === "block" && b.children,
					);
					if (block?.children) {
						bodyText = block.children.map((c: any) => c.text).join(" ");
					}
				}

				const [boldData, regularData] = await Promise.all([
					fetch(fontUrlBold).then((res) => res.arrayBuffer()),
					fetch(fontUrlRegular).then((res) => res.arrayBuffer()),
				]);

				const boldBase64 = Buffer.from(boldData).toString("base64");
				const regularBase64 = Buffer.from(regularData).toString("base64");

				const imageUrl = news.image ? news.image.og : null;

				const truncatedTitle = truncateText(news.title, 60);
				const truncatedBody = truncateText(bodyText, 150);
				const titleLines = wrapText(truncatedTitle, 25);
				const bodyLines = wrapText(truncatedBody, 50);

				const titleLineCount = titleLines.length;
				const bodyLineCount = bodyLines.length;
				const titleHeight = titleLineCount * 55;
				const bodyHeight = bodyLineCount * 35;
				const gap = 40;
				const totalContentHeight = titleHeight + gap + bodyHeight;
				const startY = 160 + (630 - totalContentHeight - 80) / 2;

				const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      @font-face {
        font-family: 'Inter';
        src: url(data:font/woff2;base64,${boldBase64}) format('woff2');
        font-weight: 700;
        font-style: normal;
      }
      @font-face {
        font-family: 'Inter';
        src: url(data:font/woff2;base64,${regularBase64}) format('woff2');
        font-weight: 400;
        font-style: normal;
      }
    </style>
  </defs>
  
  <rect width="1200" height="630" fill="white"/>
  
  ${imageUrl ? `<image x="0" y="0" width="480" height="630" preserveAspectRatio="xMidYMid slice" xlink:href="${escapeXml(imageUrl)}"/>` : ""}
  
  <rect x="480" y="0" width="720" height="630" fill="white"/>
  
  <g transform="translate(520, ${startY})">
    <text font-family="Inter, sans-serif" font-size="48" font-weight="700" fill="#111827">
      ${titleLines.map((line, i) => `<tspan x="0" dy="${i === 0 ? 0 : 55}">${escapeXml(line)}</tspan>`).join("")}
    </text>
    
    <text y="${titleHeight + gap}" font-family="Inter, sans-serif" font-size="24" fill="#374151">
      ${bodyLines.map((line, i) => `<tspan x="0" dy="${i === 0 ? 0 : 35}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </g>
  

</svg>`;

				return new Response(svg, {
					headers: {
						"Content-Type": "image/svg+xml",
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			},
		},
	},
});
