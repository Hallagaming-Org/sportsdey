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
import PDFDocument from "pdfkit";
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

async function renderPdf(table: ExportTable): Promise<Uint8Array> {
	const document = new PDFDocument({
		autoFirstPage: false,
		bufferPages: true,
		layout: table.headers.length > 8 ? "landscape" : "portrait",
		margin: 28,
		size: "A4",
	});
	const chunks: Uint8Array[] = [];
	document.on("data", (chunk: Uint8Array) =>
		chunks.push(new Uint8Array(chunk)),
	);
	const finished = new Promise<Uint8Array>((resolve, reject) => {
		document.on("end", () => {
			const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
			const result = new Uint8Array(size);
			let offset = 0;
			for (const chunk of chunks) {
				result.set(chunk, offset);
				offset += chunk.length;
			}
			resolve(result);
		});
		document.on("error", reject);
	});

	const rowHeight = 24;
	const drawHeader = () => {
		const width =
			document.page.width -
			document.page.margins.left -
			document.page.margins.right;
		const columnWidth = width / table.headers.length;
		const y = document.page.margins.top;
		document
			.save()
			.fillColor("#1F4E78")
			.rect(document.page.margins.left, y, width, rowHeight)
			.fill()
			.restore();
		document.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7);
		table.headers.forEach((header, index) => {
			document.text(
				header,
				document.page.margins.left + index * columnWidth + 3,
				y + 5,
				{ width: columnWidth - 6, height: rowHeight - 6, ellipsis: true },
			);
		});
		return y + rowHeight;
	};
	let y = 0;
	const addPage = () => {
		document.addPage();
		y = drawHeader();
	};
	addPage();
	for (const row of table.rows) {
		if (
			y + rowHeight >
			document.page.height - document.page.margins.bottom - 16
		)
			addPage();
		const width =
			document.page.width -
			document.page.margins.left -
			document.page.margins.right;
		const columnWidth = width / table.headers.length;
		document.fillColor("#000000").font("Helvetica").fontSize(7);
		row.forEach((value, index) => {
			document.text(
				String(cellValue(value)),
				document.page.margins.left + index * columnWidth + 3,
				y + 5,
				{ width: columnWidth - 6, height: rowHeight - 6, ellipsis: true },
			);
		});
		document
			.strokeColor("#D9E2F3")
			.rect(document.page.margins.left, y, width, rowHeight)
			.stroke();
		y += rowHeight;
	}
	const range = document.bufferedPageRange();
	for (let index = range.start; index < range.start + range.count; index++) {
		document.switchToPage(index);
		document
			.fillColor("#666666")
			.fontSize(7)
			.text(
				`Page ${index + 1} of ${range.count}`,
				document.page.margins.left,
				document.page.height - 20,
				{
					align: "center",
					width:
						document.page.width -
						document.page.margins.left -
						document.page.margins.right,
				},
			);
	}
	document.end();
	return finished;
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
