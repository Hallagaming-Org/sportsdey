import {
	Document,
	Packer,
	PageOrientation,
	Paragraph,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType,
} from "docx";
import ExcelJS from "exceljs";
import { Zip, ZipPassThrough } from "fflate";
import {
	PageSizes,
	PDFDocument,
	type PDFFont,
	type PDFPage,
	rgb,
	StandardFonts,
} from "pdf-lib";
import type { ExportFormat, ExportTable } from "@/types/exports";

type RenderedExport = { bytes: Uint8Array; contentType: string };

const CONTENT_TYPES: Record<ExportFormat, string> = {
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	pdf: "application/pdf",
};

function cellValue(value: string | number | null): string | number {
	return value ?? "";
}

function spreadsheetCell(value: string | number | null): string | number {
	if (typeof value !== "string") return cellValue(value);
	return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

async function renderXlsx(table: ExportTable): Promise<Uint8Array> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = "SportsDey";
	workbook.created = new Date();
	const sheet = workbook.addWorksheet("Export", {
		views: [{ state: "frozen", ySplit: 1 }],
	});
	sheet.columns = table.headers.map((header, index) => ({
		header,
		key: `column-${index}`,
		width: Math.min(40, Math.max(14, header.length + 3)),
	}));
	const header = sheet.getRow(1);
	header.font = { bold: true, color: { argb: "FFFFFFFF" } };
	header.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FF1F4E78" },
	};
	header.alignment = { vertical: "middle", wrapText: true };
	for (const row of table.rows) sheet.addRow(row.map(spreadsheetCell));
	sheet.autoFilter = {
		from: { row: 1, column: 1 },
		to: {
			row: Math.max(1, table.rows.length + 1),
			column: table.headers.length,
		},
	};
	const buffer = await workbook.xlsx.writeBuffer();
	return new Uint8Array(buffer);
}

async function renderDocx(table: ExportTable): Promise<Uint8Array> {
	const headerRow = new TableRow({
		tableHeader: true,
		children: table.headers.map(
			(header) =>
				new TableCell({
					children: [
						new Paragraph({
							children: [
								new TextRun({ text: header, bold: true, color: "FFFFFF" }),
							],
						}),
					],
					shading: { fill: "1F4E78" },
				}),
		),
	});
	const rows = table.rows.map(
		(row) =>
			new TableRow({
				children: row.map(
					(value) =>
						new TableCell({
							children: [new Paragraph({ text: String(cellValue(value)) })],
						}),
				),
			}),
	);
	const document = new Document({
		sections: [
			{
				properties: {
					page: {
						size: {
							orientation:
								table.headers.length > 8
									? PageOrientation.LANDSCAPE
									: PageOrientation.PORTRAIT,
						},
						margin: { top: 500, right: 500, bottom: 500, left: 500 },
					},
				},
				children: [
					new Table({
						rows: [headerRow, ...rows],
						width: { size: 100, type: WidthType.PERCENTAGE },
					}),
				],
			},
		],
	});
	return new Uint8Array(await Packer.toBuffer(document));
}

function pdfSafe(value: string): string {
	return value.replace(/[^\x20-\x7E]/g, "?");
}

function fitPdfText(
	text: string,
	font: PDFFont,
	size: number,
	maxWidth: number,
): string {
	const safe = pdfSafe(text);
	if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
	let fitted = safe;
	while (
		fitted.length > 0 &&
		font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth
	) {
		fitted = fitted.slice(0, -1);
	}
	return fitted.length ? `${fitted}...` : "";
}

async function renderPdf(table: ExportTable): Promise<Uint8Array> {
	const landscape = table.headers.length > 8;
	const document = await PDFDocument.create();
	const font = await document.embedFont(StandardFonts.Helvetica);
	const fontBold = await document.embedFont(StandardFonts.HelveticaBold);
	const pageSize = landscape
		? ([PageSizes.A4[1], PageSizes.A4[0]] as [number, number])
		: PageSizes.A4;
	const margin = 28;
	const rowHeight = 24;
	const fontSize = 7;
	const headerFill = rgb(0x1f / 255, 0x4e / 255, 0x78 / 255);
	const grid = rgb(0xd9 / 255, 0xe2 / 255, 0xf3 / 255);
	const pages: PDFPage[] = [];

	const addPage = () => {
		const page = document.addPage(pageSize);
		pages.push(page);
		const { width, height } = page.getSize();
		const tableWidth = width - margin * 2;
		const columnWidth = tableWidth / Math.max(1, table.headers.length);
		const headerBottom = height - margin - rowHeight;
		page.drawRectangle({
			x: margin,
			y: headerBottom,
			width: tableWidth,
			height: rowHeight,
			color: headerFill,
		});
		table.headers.forEach((header, index) => {
			page.drawText(fitPdfText(header, fontBold, fontSize, columnWidth - 6), {
				x: margin + index * columnWidth + 3,
				y: headerBottom + 8,
				size: fontSize,
				font: fontBold,
				color: rgb(1, 1, 1),
			});
		});
		return {
			page,
			width,
			height,
			tableWidth,
			columnWidth,
			y: headerBottom,
		};
	};

	let current = addPage();
	for (const row of table.rows) {
		if (current.y - rowHeight < margin + 16) current = addPage();
		current.y -= rowHeight;
		current.page.drawRectangle({
			x: margin,
			y: current.y,
			width: current.tableWidth,
			height: rowHeight,
			borderColor: grid,
			borderWidth: 0.5,
		});
		row.forEach((value, index) => {
			current.page.drawText(
				fitPdfText(
					String(cellValue(value)),
					font,
					fontSize,
					current.columnWidth - 6,
				),
				{
					x: margin + index * current.columnWidth + 3,
					y: current.y + 8,
					size: fontSize,
					font,
					color: rgb(0, 0, 0),
				},
			);
		});
	}

	const total = pages.length;
	pages.forEach((page, index) => {
		const { width } = page.getSize();
		const label = `Page ${index + 1} of ${total}`;
		const labelWidth = font.widthOfTextAtSize(label, fontSize);
		page.drawText(label, {
			x: (width - labelWidth) / 2,
			y: 12,
			size: fontSize,
			font,
			color: rgb(0.4, 0.4, 0.4),
		});
	});

	return document.save();
}

export async function renderExportChunk(
	format: ExportFormat,
	table: ExportTable,
): Promise<RenderedExport> {
	const bytes =
		format === "xlsx"
			? await renderXlsx(table)
			: format === "docx"
				? await renderDocx(table)
				: await renderPdf(table);
	return { bytes, contentType: CONTENT_TYPES[format] };
}

async function waitForCapacity(
	controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
	while ((controller.desiredSize ?? 1) <= 0) {
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

async function pipeR2Body(
	body: ReadableStream,
	file: ZipPassThrough,
	controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
	const reader = body.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			await waitForCapacity(controller);
			file.push(value, false);
		}
		file.push(new Uint8Array(0), true);
	} finally {
		reader.releaseLock();
	}
}

export function createZipStream(
	files: Array<{ name: string; body: ReadableStream }>,
): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>(
		{
			start(controller) {
				const archive = new Zip((error, chunk, final) => {
					if (error) return controller.error(error);
					controller.enqueue(chunk);
					if (final) controller.close();
				});
				void (async () => {
					try {
						for (const source of files) {
							const file = new ZipPassThrough(source.name);
							archive.add(file);
							await pipeR2Body(source.body, file, controller);
						}
						archive.end();
					} catch (error) {
						archive.terminate();
						controller.error(error);
					}
				})();
			},
		},
		new ByteLengthQueuingStrategy({ highWaterMark: 1024 * 1024 }),
	);
}
