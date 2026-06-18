import { X } from "lucide-react";
import SuccessIndicator from "@/logos/SuccessIndicator.png";

type SuccessModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	message?: string;
};

export function SuccessModal({
	isOpen,
	onClose,
	title = "Success!",
	message = "Your action has been processed successfully.",
}: SuccessModalProps) {
	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]">
			<div className="relative w-full max-w-[360px] rounded-3xl border border-gray-600 bg-[#000606] p-8 text-center shadow-xl">
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#6C7073] text-[#6C7073] transition-colors"
				>
					<X className="h-4 w-4" />
				</button>

				<div className="flex flex-col items-center pt-6 pb-2">
					<div className="relative mb-6 flex items-center justify-center">
						<img
							src={SuccessIndicator}
							alt="Success"
							className="h-[88px] w-[88px]"
						/>
					</div>

					<h2 className="mb-3 font-bold text-[28px] text-primary tracking-tight dark:text-white">
						{title}
					</h2>
					<p className="mb-8 px-2 font-medium text-[#8C8F8F] text-[15px] text-secondary leading-relaxed dark:text-[#8C8F8F]">
						{message}
					</p>

					<button
						type="button"
						onClick={onClose}
						className="w-[138px] cursor-pointer rounded-full bg-[#00D600] py-4 font-bold text-[17px] text-white transition-opacity hover:opacity-90"
					>
						Done
					</button>
				</div>
			</div>
		</div>
	);
}
