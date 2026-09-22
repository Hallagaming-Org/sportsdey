import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { SuccessModal } from "@/components/success-modal";
import { ApiError, apiRequest } from "@/lib/api";
import { formatAmount } from "@/lib/utils";

type BankOption = {
	name: string;
	code: string;
};

type WithdrawResponse = {
	reference: string;
	amount: number;
	status: string;
};

const MIN_WITHDRAW_AMOUNT = 100;

type WithdrawModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onUnauthorized: () => void;
	walletBalance?: number;
};

export function WithdrawModal({
	isOpen,
	onClose,
	onUnauthorized,
	walletBalance = 0,
}: WithdrawModalProps) {
	const [withdrawAmount, setWithdrawAmount] = useState("");
	const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
	const [withdrawAccountName, setWithdrawAccountName] = useState("");
	const [selectedBankCode, setSelectedBankCode] = useState("");
	const [selectedBankName, setSelectedBankName] = useState("");
	const [withdrawError, setWithdrawError] = useState("");
	const [isSuccess, setIsSuccess] = useState(false);

	const { data: banks = [], isLoading: isBanksLoading } = useQuery({
		queryKey: ["wallet-banks"],
		queryFn: () =>
			apiRequest<BankOption[]>("wallet/banks", {
				credentials: "include",
			}),
		enabled: isOpen,
	});

	const withdrawMutation = useMutation({
		mutationFn: (payload: {
			amount: number;
			bankCode: string;
			accountNumber: string;
			accountName: string;
		}) =>
			apiRequest<WithdrawResponse>("wallet/withdraw", {
				method: "POST",
				credentials: "include",
				body: JSON.stringify(payload),
			}),
		onSuccess: () => {
			setIsSuccess(true);
		},
		onError: (error) => {
			if (error instanceof ApiError && error.status === 401) {
				onUnauthorized();
				return;
			}
			setWithdrawError(
				error instanceof ApiError
					? error.message
					: "Failed to process withdrawal. Please try again.",
			);
		},
	});

	if (!isOpen) {
		return null;
	}

	const handleClose = () => {
		setWithdrawAmount("");
		setWithdrawAccountNumber("");
		setWithdrawAccountName("");
		setSelectedBankCode("");
		setSelectedBankName("");
		setWithdrawError("");
		setIsSuccess(false);
		onClose();
	};

	const handleWithdrawSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const amount = Number(withdrawAmount);

		if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_AMOUNT) {
			setWithdrawError(
				`Minimum withdrawal amount is ₦${formatAmount(MIN_WITHDRAW_AMOUNT)}.`,
			);
			return;
		}
		if (!selectedBankCode) {
			setWithdrawError("Please select a bank.");
			return;
		}
		if (!/^\d{10}$/.test(withdrawAccountNumber)) {
			setWithdrawError("Please enter a valid 10-digit account number.");
			return;
		}
		if (!withdrawAccountName.trim()) {
			setWithdrawError("Please enter account name.");
			return;
		}

		setWithdrawError("");
		withdrawMutation.mutate({
			amount,
			bankCode: selectedBankCode,
			accountNumber: withdrawAccountNumber.trim(),
			accountName: withdrawAccountName.trim(),
		});
		setIsSuccess(true);
	};

	if (isSuccess) {
		return (
			<SuccessModal
				isOpen={isSuccess}
				onClose={handleClose}
				title="Success!"
				message="Your withdrawal has been processed and you will be credited shortly."
			/>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-y-contain bg-black/40 p-3 sm:items-center sm:p-4">
			<div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md min-w-0 overflow-y-auto overscroll-y-contain rounded-2xl bg-white p-5 shadow-lg [-webkit-overflow-scrolling:touch] sm:p-6 dark:bg-[#202120]">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-primary text-xl dark:text-white">
						Withdraw Funds
					</h2>
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close withdraw modal"
						className={`cursor-pointer rounded-md px-2 py-1 text-sm ${
							isSuccess ? "text-[#10C300]" : "text-primary dark:text-white"
						}`}
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{isSuccess ? (
				<div className="mt-4 flex flex-col items-center space-y-4 py-8">
					<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10C300]/20">
						<Check className="h-8 w-8 text-[#10C300]" />
					</div>
					<p className="text-center text-white text-lg">
						Your withdrawal is being processed and you will be credited
						shortly.
					</p>
					<button
						type="button"
						onClick={handleClose}
						className="w-full cursor-pointer rounded-lg bg-[#10C300] px-4 py-2 font-medium text-sm text-white"
					>
						Close
					</button>
				</div>
			) : (
				<form className="mt-4 space-y-4" onSubmit={handleWithdrawSubmit}>
					<div>
						<label className="mb-2 block font-medium text-primary text-sm dark:text-white">
							Amount (NGN)
						</label>
						<Input
							type="number"
							min={MIN_WITHDRAW_AMOUNT}
							step="0.01"
							value={withdrawAmount}
							onChange={(event) => setWithdrawAmount(event.target.value)}
							placeholder="Enter amount"
						/>
					</div>

					<div>
						<label className="mb-2 block font-medium text-primary text-sm dark:text-white">
							Bank
						</label>
						<select
							value={selectedBankCode}
							onChange={(event) => {
								const code = event.target.value;
								const bank = banks.find((item) => item.code === code);
								setSelectedBankCode(code);
								setSelectedBankName(bank?.name || "");
							}}
							className="w-full cursor-pointer rounded-md border border-[#E5E5E5] bg-white p-2 text-primary text-sm dark:bg-[#202120] dark:text-white"
						>
							<option value="" disabled={isBanksLoading}>
								{isBanksLoading ? "Loading banks..." : "Select bank"}
							</option>
							{banks.map((bank) => (
								<option key={bank.code} value={bank.code}>
									{bank.name}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="mb-2 block font-medium text-primary text-sm dark:text-white">
							Account Number
						</label>
						<Input
							type="text"
							inputMode="numeric"
							value={withdrawAccountNumber}
							onChange={(event) =>
								setWithdrawAccountNumber(
									event.target.value.replace(/\D/g, "").slice(0, 10),
								)
							}
							placeholder="e.g. 0123456789"
						/>
					</div>

					<div>
						<label className="mb-2 block font-medium text-primary text-sm dark:text-white">
							Account Name
						</label>
						<Input
							type="text"
							value={withdrawAccountName}
							onChange={(event) => setWithdrawAccountName(event.target.value)}
							placeholder="e.g. John Doe"
						/>
					</div>

					{withdrawError && (
						<p className="text-[#D13030] text-sm">{withdrawError}</p>
					)}

					<button
						type="submit"
						disabled={withdrawMutation.isPending}
						className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
					>
						{withdrawMutation.isPending ? "Processing..." : "Withdraw"}
					</button>
				</form>
			)}
			</div>
		</div>
	);
}
