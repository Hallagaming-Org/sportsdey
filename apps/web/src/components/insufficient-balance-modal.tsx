import { X, WalletCards } from "lucide-react";

type InsufficientBalanceModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onTopUp: () => void;
};

export function InsufficientBalanceModal({
	isOpen,
	onClose,
	onTopUp,
}: InsufficientBalanceModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
			<div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-[#202120] border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
				<div className="flex items-center justify-between mb-2">
					<h2 className="font-bold text-gray-900 text-xl dark:text-white">
						Insufficient Balance
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="cursor-pointer rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				
				<div className="flex flex-col items-center py-4 text-center">
					<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
						<WalletCards className="h-8 w-8 text-red-500" />
					</div>
					<p className="text-gray-600 dark:text-gray-300 text-[15px] mb-8 leading-relaxed">
						You do not have enough funds to place this bet. Please top up your wallet to continue playing.
					</p>
					
					<div className="flex w-full gap-3">
						<button
							onClick={onClose}
							className="cursor-pointer flex-1 rounded-xl px-4 py-3 font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
						>
							Cancel
						</button>
						<button
							onClick={onTopUp}
							className="cursor-pointer flex-1 rounded-xl px-4 py-3 font-semibold bg-[#1BAA04] text-white hover:bg-[#158a03] transition-colors shadow-lg shadow-[#1BAA04]/20"
						>
							Deposit Funds
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
