import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { trackWebengageEvent } from "@/lib/webengage";

type TransferResponse = {
	transactionId: string;
	amount: number;
	recipientWalletId: string;
	recipientName: string;
};

const MIN_TRANSFER_AMOUNT = 100;

type TransferModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onUnauthorized: () => void;
};

export function TransferModal({
	isOpen,
	onClose,
	onUnauthorized,
}: TransferModalProps) {
	const [recipientWalletId, setRecipientWalletId] = useState("");
	const [transferAmount, setTransferAmount] = useState("");
	const [transferError, setTransferError] = useState("");
	const [transferSuccess, setTransferSuccess] = useState("");

	const transferMutation = useMutation({
		mutationFn: (payload: { recipientWalletId: string; amount: number }) =>
			apiRequest<TransferResponse>("wallet/transfer", {
				method: "POST",
				credentials: "include",
				body: JSON.stringify(payload),
			}),
		onSuccess: (data) => {
			setTransferSuccess(
				`₦${formatAmount(data.amount)} transferred to ${data.recipientName}`,
			);
			trackWebengageEvent("transfer_funds initated", {
				"wallet id": recipientWalletId.trim(),
				amount: data.amount,
			});
			setTimeout(() => {
				handleClose();
			}, 2000);
		},
		onError: (error) => {
			if (error instanceof ApiError && error.status === 401) {
				onUnauthorized();
				return;
			}
			setTransferError(
				error instanceof ApiError
					? error.message
					: "Failed to process transfer. Please try again.",
			);
		},
	});

	if (!isOpen) {
		return null;
	}

	const handleClose = () => {
		setRecipientWalletId("");
		setTransferAmount("");
		setTransferError("");
		setTransferSuccess("");
		onClose();
	};

	const handleTransferSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const amount = Number(transferAmount);

		if (!recipientWalletId.trim()) {
			setTransferError("Please enter the recipient's wallet ID.");
			return;
		}
		if (!Number.isFinite(amount) || amount < MIN_TRANSFER_AMOUNT) {
			setTransferError(
				`Minimum transfer amount is ₦${formatAmount(MIN_TRANSFER_AMOUNT)}.`,
			);
			return;
		}

		setTransferError("");
		transferMutation.mutate({
			recipientWalletId: recipientWalletId.trim(),
			amount,
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
			<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-[#202120]">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-primary text-xl dark:text-white">
						Transfer Funds
					</h2>
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close transfer modal"
						className="cursor-pointer rounded-md px-2 py-1 text-primary text-sm dark:text-white"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{transferSuccess ? (
					<div className="mt-6 text-center">
						<p className="font-medium text-[#14804A] text-sm">
							{transferSuccess}
						</p>
					</div>
				) : (
					<form className="mt-4 space-y-4" onSubmit={handleTransferSubmit}>
						<div>
							<label className="mb-2 block font-medium text-primary text-sm dark:text-white">
								Recipient Wallet ID
							</label>
							<Input
								type="text"
								value={recipientWalletId}
								onChange={(event) => setRecipientWalletId(event.target.value)}
								placeholder="Enter recipient's wallet ID"
							/>
						</div>

						<div>
							<label className="mb-2 block font-medium text-primary text-sm dark:text-white">
								Amount (NGN)
							</label>
							<Input
								type="number"
								min={MIN_TRANSFER_AMOUNT}
								step="0.01"
								value={transferAmount}
								onChange={(event) => setTransferAmount(event.target.value)}
								placeholder="Enter amount"
							/>
							<p className="mt-2 text-[#6E6E6E] text-xs">
								Min: ₦{MIN_TRANSFER_AMOUNT.toLocaleString("en-NG")}.00
							</p>
						</div>

						{transferError && (
							<p className="text-[#D13030] text-sm">{transferError}</p>
						)}

						<button
							type="submit"
							disabled={transferMutation.isPending}
							className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
						>
							{transferMutation.isPending ? "Processing..." : "Transfer"}
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
