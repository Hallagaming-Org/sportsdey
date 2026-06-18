import { ChevronLeft, Copy, Info } from "lucide-react";
import type { ReactNode } from "react";

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

export function TransactionReceipt({
	title = "Transaction Details",
	statusTitle = "Successful",
	statusMessage = "Transaction has been completed.",
	details,
	onBack,
	onShare,
}: TransactionReceiptProps) {
	const handleCopy = (text: string) => {
		navigator.clipboard.writeText(text);
		// Note: A toast notification could be triggered here in a real implementation
	};

	if (!details || details.length === 0) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]">
			<div className="relative mx-auto flex w-full max-w-md flex-col rounded-3xl border border-gray-600 bg-[#000606] text-white shadow-xl overflow-hidden max-h-[90vh]">
				{/* App Bar */}
				<div className="flex items-center px-4 py-6">
					<button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#6C7073] text-[#6C7073] transition-colors">
						<ChevronLeft className="h-4 w-4" />
					</button>
					<h1 className="flex-1 text-center font-semibold text-lg">{title}</h1>
					<div className="w-8" /> {/* Spacer for centering */}
				</div>

				<div className="flex-1 overflow-y-auto px-6">
					{/* Status Banner */}
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

					{/* Details Card */}
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

				{/* Bottom Action Area */}
				<div className="p-6">
					<button
						type="button"
						onClick={onShare}
						className="w-full cursor-pointer rounded-full bg-[#00D600] py-4 font-bold text-white transition-opacity hover:opacity-90"
					>
						Share
					</button>
				</div>
			</div>
		</div>
	);
}
