import { ChevronLeft, Copy, Info } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import NewSportsdeyLogoUrl from "@/logos/NewSportsdeyLogo.svg?url";

export type ReceiptDetail = {
	label: string;
	value: ReactNode;
	copyable?: boolean;
	valueClassName?: string;
};

export type TransactionReceiptProps = {
	title?: string;
	statusTitle?: string;
	statusMessage?: string;
	details: ReceiptDetail[];
	onBack?: () => void;
	backLink?: string;
	onShare?: () => void;
};

function WatermarkBackground() {
	return (
		<div className="absolute inset-0 z-0 overflow-hidden opacity-5 pointer-events-none">
			<div className="w-[150%] h-[150%] -translate-x-[25%] -translate-y-[25%] -rotate-45 flex flex-wrap gap-8 items-center justify-center pt-20">
				{Array.from({ length: 40 }).map((_, i) => (
					<img
						key={i}
						src={NewSportsdeyLogoUrl}
						alt=""
						className="w-32 h-auto opacity-40 grayscale"
					/>
				))}
			</div>
		</div>
	);
}

export function TransactionReceipt({
	title = "Transaction Details",
	statusTitle = "Successful",
	statusMessage = "Transaction has been completed.",
	details,
	onBack,
	onShare,
}: TransactionReceiptProps) {
	const [isSharing, setIsSharing] = useState(false);
	const receiptRef = useRef<HTMLDivElement>(null);

	const handleCopy = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	const handleShare = async () => {
		// If custom onShare is provided, use it instead (useful for previews)
		if (onShare) {
			onShare();
			return;
		}

		if (!receiptRef.current) return;

		try {
			setIsSharing(true);

			// Wait a brief moment for any pending renders
			await new Promise((resolve) => setTimeout(resolve, 100));

			const blob = await toBlob(receiptRef.current, {
				quality: 1,
				pixelRatio: 2,
				backgroundColor: '#04100B',
				style: {
					fontFamily: 'Inter, sans-serif' // Provide a fallback if fonts don't load immediately in the cloned DOM
				}
			});

			if (!blob) throw new Error("Failed to generate image blob");

			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = "sportsdey-receipt.png";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Error sharing receipt:", error);
			alert("Unable to generate and share receipt. Please try again.");
		} finally {
			setIsSharing(false);
		}
	};

	if (!details || details.length === 0) return null;

	// Extract amount to show prominently in the watermark receipt
	const amountDetail = details.find(d => d.label.toLowerCase() === 'amount');
	const transactionTypeDetail = details.find(d => d.label.toLowerCase() === 'transaction type');

	const mainAmountText = amountDetail ? amountDetail.value : "";
	const transactionTypeText = transactionTypeDetail ? transactionTypeDetail.value : "";

	return (
		<>
			{/* HIDDEN RECEIPT FOR HTML-TO-IMAGE */}
			<div className="fixed top-0 left-[-9999px] z-[-1] pointer-events-none">
				<div
					ref={receiptRef}
					className="relative flex flex-col bg-[#04100B] text-white overflow-hidden"
					style={{ width: "400px", minHeight: "650px", padding: "32px 24px" }}
				>
					<WatermarkBackground />

					<div className="relative z-10 flex flex-col h-full">
						{/* Header */}
						<div className="flex items-start justify-between mb-10">
							<img src={NewSportsdeyLogoUrl} alt="Sportsdey" className="h-8 w-auto" />
							<div className="text-right">
								<p className="text-sm font-medium text-white">Transaction Receipt</p>
							</div>
						</div>

						{/* Massive Amount & Status */}
						<div className="flex flex-col items-center justify-center mb-10">
							<h1 className="text-4xl font-black text-white mb-2 tracking-tight">
								{mainAmountText}
							</h1>
							<p className="text-base font-bold text-white">{statusTitle}</p>
						</div>

						{/* Table Details */}
						<div className="flex flex-col mb-10">
							<div className="border-t border-b border-[#1A221E] py-1 mb-2 flex justify-between items-center h-12">
								<span className="text-[#6C7073] text-sm">Transaction Type</span>
								<span className="text-white font-medium text-sm">{transactionTypeText}</span>
							</div>

							{details.filter(d => !['transaction type'].includes(d.label.toLowerCase())).map((detail, index) => (
								<div key={index} className="border-b border-[#1A221E] py-1 mb-2 flex justify-between items-center h-12">
									<span className="text-[#6C7073] text-sm">{detail.label}</span>
									<span className="text-white font-medium text-sm text-right">{detail.value}</span>
								</div>
							))}
						</div>

						<div className="mt-auto">
							{/* Badges */}
							<div className="flex gap-4 justify-center mb-6">
								<div className="flex items-center gap-2 bg-[#00D600] text-white px-4 py-2 rounded-lg text-xs font-bold w-[140px] justify-center">
									<svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.15 2.67.72 3.4 1.8-3.12 1.87-2.61 5.98.38 7.22-.64 1.62-1.45 2.92-2.43 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.45-1.92 4.41-3.74 4.25z" /></svg>
									<div className="flex flex-col items-start leading-none">
										<span className="text-[8px] font-normal">Get it on</span>
										<span>App Store</span>
									</div>
								</div>
								<div className="flex items-center gap-2 bg-[#00D600] text-white px-4 py-2 rounded-lg text-xs font-bold w-[140px] justify-center">
									<svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M3.79 2.25c-.32 0-.58.12-.76.32L3 2.6v18.8l.03.03.76.32 10.6-10.6L3.79 2.25zM15 11.83l-1.61 1.62L3.81 21.6 15 11.83zM15.8 12.5l2.25 1.29c.67.38.67 1 0 1.38L15.8 16.4l-1.61-1.61L15.8 12.5zM3.81 2.4L14.2 11.45 15.8 12.5 3.81 2.4z" /></svg>
									<div className="flex flex-col items-start leading-none">
										<span className="text-[8px] font-normal">Get it on</span>
										<span>Google Play</span>
									</div>
								</div>
							</div>

							{/* Footer Fine Print */}
							<div className="text-center text-[#6C7073] text-[9px] leading-relaxed px-4">
								For more information, please contact us: 020*****530, ****0625000<br />
								Sportsdeycontactcomplaints@Sportsdey.com, complaints@Sportsdey.com<br />
								www.Sportsdey.com
							</div>
						</div>
					</div>
				</div>
			</div>


			{/* VISIBLE MODAL */}
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]">
				<div className="relative mx-auto flex w-full max-w-md flex-col rounded-3xl border border-gray-600 bg-[#000606] text-white shadow-xl overflow-hidden max-h-[90vh]">
					<div className="flex items-center px-4 py-6">
						<button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#6C7073] text-[#6C7073] transition-colors hover:bg-white/10">
							<ChevronLeft className="h-4 w-4" />
						</button>
						<h1 className="flex-1 text-center font-semibold text-lg">{title}</h1>
						<div className="w-8" />
					</div>

					<div className="flex-1 overflow-y-auto px-6">
						<div className="mb-6 flex items-center rounded-xl bg-[#EAFFE7] gap-x-2 p-4 shadow-sm">
							<div className="w-11 h-11 flex justify-center items-center bg-[#23BF09] rounded-[8px]">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
									<Info className="h-6 w-6 text-white" />
								</div>
							</div>
							<div>
								<h2 className="font-bold text-black">{statusTitle}</h2>
								<p className="text-[#757979] text-xs">{statusMessage}</p>
							</div>
						</div>

						<div className="rounded-2xl border border-[#1A221E] bg-[#0A120E] p-5">
							<div className="space-y-5">
								{details.map((detail, index) => (
									<div
										key={index}
										className="flex items-center justify-between text-sm"
									>
										<span className="text-[#6C7073]">{detail.label}</span>
										<div className="flex items-center gap-2">
											<span
												className={`font-medium ${detail.valueClassName || "text-white"}`}
											>
												{detail.value}
											</span>
											{detail.copyable && (
												<button
													type="button"
													onClick={() => {
														const textToCopy = typeof detail.value === "string" ? detail.value : String(detail.value);
														handleCopy(textToCopy);
													}}
													className="cursor-pointer text-[#00D600] transition-opacity hover:opacity-80"
													aria-label="Copy"
												>
													<Copy className="h-4 w-4" />
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
					<div className="p-6">
						<button
							type="button"
							onClick={handleShare}
							disabled={isSharing}
							className="w-full flex items-center justify-center cursor-pointer rounded-lg bg-[#00D600] py-4 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{isSharing ? "Generating..." : "Download"}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
