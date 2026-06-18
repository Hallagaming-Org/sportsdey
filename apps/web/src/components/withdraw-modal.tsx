import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import SuccessIndicator from "@/logos/SuccessIndicator.png";

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
};

export function WithdrawModal({
	isOpen,
	onClose,
	onUnauthorized,
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
	};

	if (isSuccess) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]">
				<div className="relative w-full max-w-[360px] rounded-3xl bg-white p-8 shadow-xl text-center border border-gray-100 dark:bg-[#0B100E] dark:border-[#1E201F]">
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close"
						className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:border-[#2A2D2C] dark:text-[#8C8F8F] dark:hover:bg-white/10 dark:hover:text-white"
					>
						<X className="h-4 w-4" />
					</button>

					<div className="flex flex-col items-center pt-6 pb-2">
						<div className="mb-6 relative flex items-center justify-center">
							<img src={SuccessIndicator} alt="Success" className="h-[88px] w-[88px]" />
						</div>

						<h2 className="mb-3 font-bold text-[28px] tracking-tight text-primary dark:text-white">Success!</h2>
						<p className="mb-8 font-medium text-secondary dark:text-[#8C8F8F] text-[15px] leading-relaxed px-2">
							Your withdrawal has been processed and you will be credited shortly.
						</p>

						<button
							type="button"
							onClick={handleClose}
							className="w-full cursor-pointer rounded-full bg-[#00D600] py-4 font-bold text-[17px] text-white transition-opacity hover:opacity-90"
						>
							Done
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
			<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-[#202120]">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-primary text-xl dark:text-white">
						Withdraw Funds
					</h2>
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close withdraw modal"
						className="cursor-pointer rounded-md px-2 py-1 text-primary text-sm dark:text-white"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

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
							placeholder="0123456789"
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
							placeholder="John Doe"
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
			</div>
		</div>
	);
}
