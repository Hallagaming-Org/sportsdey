import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useLocation } from "@tanstack/react-router";
import { Copy, Eye, EyeOff, Loader2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { BillPaymentModal } from "@/components/bill-payment-modal";
import { TransferModal } from "@/components/transfer-modal";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletInfo } from "@/components/wallet-info";
import { WalletRecentTransactions } from "@/components/wallet-recent-transactions";
import { WithdrawModal } from "@/components/withdraw-modal";
import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { formatAmount } from "@/lib/utils";
import AirtimeIcon from "@/logos/airtime.svg?react";
import CableTvIcon from "@/logos/cable-tv.svg?react";
import ElectricityIcon from "@/logos/electricity.svg?react";
import InternetIcon from "@/logos/internet.svg?react";
import WalletIcon from "@/logos/wallet.svg?react";

export const Route = createFileRoute("/wallet")({
	component: WalletPage,
});

type WalletResponse = {
	id: string;
	balance?: number | null;
	createdAt: string;
	updatedAt: string;
};

type WalletTransaction = {
	id: string;
	userId: string;
	amount?: number | null;
	type: string;
	reference: string;
	status: string;
	paymentMethod?: string | null;
	metadata?: Record<string, unknown> | null;
	createdAt?: string | null;
};

type FundWalletResponse = {
	authorizationUrl: string;
	reference: string;
};

const MIN_DEPOSIT_AMOUNT = 100;
const MAX_DEPOSIT_AMOUNT = 9_999_999;

function WalletPage() {
	const [showBalance, setShowBalance] = useState(true);
	const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
	const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
	const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
	const [depositAmount, setDepositAmount] = useState("");
	const [depositError, setDepositError] = useState("");
	const [shouldRedirectToSignIn, setShouldRedirectToSignIn] = useState(false);
	const [isBillPaymentOpen, setIsBillPaymentOpen] = useState(false);
	const [billPaymentCategory, setBillPaymentCategory] = useState<{
		code: string;
		name: string;
	} | null>(null);
	const location = useLocation();
	useEffect(() => {
		if ((location.state as { openDeposit?: boolean })?.openDeposit) {
			setIsDepositModalOpen(true);
		}
	}, [location.state]);
	const { data: session, isPending: isSessionLoading } = useSession();
	const {
		data: walletData,
		isLoading: isWalletLoading,
		error: walletError,
	} = useQuery({
		queryKey: ["wallet"],
		queryFn: () =>
			apiRequest<WalletResponse>("wallet", {
				credentials: "include",
			}),
		enabled: !!session?.user,
	});
	const { data: transactions = [], isLoading: isTransactionsLoading } =
		useQuery({
			queryKey: ["wallet-transactions"],
			queryFn: () =>
				apiRequest<WalletTransaction[]>("wallet/transactions", {
					credentials: "include",
				}),
			enabled: !!session?.user,
		});
	const depositMutation = useMutation({
		mutationFn: (amount: number) =>
			apiRequest<FundWalletResponse>("wallet/fund", {
				method: "POST",
				credentials: "include",
				body: JSON.stringify({ amount }),
			}),
		onSuccess: (data) => {
			window.open(data.authorizationUrl, "_blank", "noopener,noreferrer");
			setIsDepositModalOpen(false);
			setDepositAmount("");
			setDepositError("");
		},
		onError: (error) => {
			if (error instanceof ApiError && error.status === 401) {
				setShouldRedirectToSignIn(true);
				return;
			}
			setDepositError(
				error instanceof ApiError
					? error.message
					: "Failed to initialize deposit. Please try again.",
			);
		},
	});

	if (!isSessionLoading && (!session?.user || shouldRedirectToSignIn)) {
		return <Navigate to="/auth/sign-in" />;
	}

	if (walletError instanceof ApiError && walletError.status === 401) {
		return <Navigate to="/auth/sign-in" />;
	}

	const isInitialPageLoading = isSessionLoading;
	const isWalletSectionLoading = isWalletLoading;
	const walletBalance = formatAmount(walletData?.balance);
	const validateDepositAmount = (amount: number) => {
		if (!Number.isFinite(amount)) {
			return "Enter a valid amount.";
		}
		if (amount < MIN_DEPOSIT_AMOUNT) {
			return `Minimum deposit amount is ₦${formatAmount(MIN_DEPOSIT_AMOUNT)}.`;
		}
		if (amount > MAX_DEPOSIT_AMOUNT) {
			return `Maximum deposit amount is ₦${formatAmount(MAX_DEPOSIT_AMOUNT)}.`;
		}
		return "";
	};

	const handleDepositSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const amount = Number(depositAmount);
		const error = validateDepositAmount(amount);
		if (error) {
			setDepositError(error);
			return;
		}

		setDepositError("");
		depositMutation.mutate(amount);
	};

	return (
		<>
			{isInitialPageLoading ? (
				<div className="flex min-h-[320px] items-center justify-center rounded-2xl bg-white p-6 shadow-sm dark:bg-[#202120]">
					<Loader2 className="h-8 w-8 animate-spin text-primary dark:text-white" />
				</div>
			) : (
				<>
					<div className="mb-6 flex flex-col gap-4 lg:grid lg:grid-cols-5">
						<div className="space-y-4 lg:col-span-3">
							<div className="h-fit self-start rounded-2xl border border-[#1B2722] bg-[#04100B] p-[20px] shadow-sm">
								<div className="flex items-center justify-between">
									<p className="font-semibold text-[30px] text-primary dark:text-white">
										Wallet
									</p>
									<div className="flex h-[40px] w-[60px] items-center justify-center rounded-lg border border-[#1B2722] bg-[#04100B]">
										<WalletIcon
											width={18}
											height={18}
											className="block text-[#6C7073]"
										/>
									</div>
								</div>
							</div>
							<div className="min-h-40 w-full rounded-2xl border border-[#1B2722] bg-[#000606] p-6 shadow-sm">
								<p className="text-[14px] text-primary dark:text-white">
									Wallet Balance
								</p>
								{walletData?.id && !isWalletSectionLoading && (
									<div className="mt-2 flex items-center gap-2">
										<span className="max-w-[200px] truncate font-mono text-[#6C7073] text-[12px]">
											ID: {walletData.id}
										</span>
										<button
											type="button"
											onClick={() => {
												navigator.clipboard.writeText(walletData.id);
											}}
											className="cursor-pointer text-[#6C7073] transition-colors hover:text-white"
											aria-label="Copy wallet ID"
										>
											<Copy className="h-3.5 w-3.5" />
										</button>
									</div>
								)}
								<div className="mt-3 flex items-start gap-2">
									<p className="font-semibold text-primary leading-none dark:text-white">
										{isWalletSectionLoading ? (
											<Skeleton className="h-[50px] w-[150px]" />
										) : showBalance ? (
											<span className="space-x-2 leading-none">
												<span className="relative -top-2 align-super text-[24px]">
													₦
												</span>
												<span className="text-[50px]">{walletBalance}</span>
											</span>
										) : (
											<span className="text-[50px]">••••••</span>
										)}
									</p>
									{/* {!isWalletSectionLoading && (
										<button
											type="button"
											onClick={() => setShowBalance((prev) => !prev)}
											className="cursor-pointer mt-2 text-primary dark:text-white"
											aria-label={
												showBalance
													? "Hide wallet balance"
													: "Show wallet balance"
											}
										>
											{showBalance ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									)} */}
								</div>
								<div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
									<button
										type="button"
										onClick={() => {
											setDepositError("");
											setIsDepositModalOpen(true);
										}}
										className="w-full cursor-pointer rounded-lg border border-[#1B2722] bg-[#04100B] px-4 py-2 font-medium text-sm text-white"
									>
										Deposit
									</button>
									<button
										type="button"
										onClick={() => {
											setIsTransferModalOpen(true);
										}}
										className="w-full cursor-pointer rounded-lg border border-[#1B2722] bg-[#04100B] px-4 py-2 font-medium text-sm text-white"
									>
										Transfer funds
									</button>
									<button
										type="button"
										onClick={() => {
											setIsWithdrawModalOpen(true);
										}}
										className="w-full cursor-pointer rounded-lg border border-[#1B2722] bg-[#04100B] px-4 py-2 font-medium text-sm text-white"
									>
										Withdraw
									</button>
								</div>
							</div>
						</div>
						<div className="min-h-40 rounded-2xl border border-[#1B2722] bg-[#000606] p-6 shadow-sm lg:col-span-2">
							<p className="border-[#1B2722] border-b pb-3 font-semibold text-base text-primary dark:text-white">
								Quick Access
							</p>
							<ul className="mt-4 grid grid-cols-4 gap-3 lg:flex lg:flex-col lg:gap-3">
								<li>
									<button
										type="button"
										onClick={() => {
											setBillPaymentCategory({
												code: "AIRTIME",
												name: "Airtime",
											});
											setIsBillPaymentOpen(true);
										}}
										className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-[#1B2722] bg-[#04100B] p-2 lg:flex-row lg:justify-start lg:gap-3 lg:p-3"
									>
										<AirtimeIcon className="h-5 w-5 text-white" />
										<span className="text-center font-medium text-[10px] text-white sm:text-xs lg:text-sm">
											Airtime
										</span>
									</button>
								</li>
								<li>
									<button
										type="button"
										onClick={() => {
											setBillPaymentCategory({
												code: "DATA_BUNDLE",
												name: "Internet",
											});
											setIsBillPaymentOpen(true);
										}}
										className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-[#1B2722] bg-[#04100B] p-2 lg:flex-row lg:justify-start lg:gap-3 lg:p-3"
									>
										<InternetIcon className="h-5 w-5 text-white" />
										<span className="text-center font-medium text-[10px] text-white sm:text-xs lg:text-sm">
											Internet
										</span>
									</button>
								</li>
								<li>
									<button
										type="button"
										onClick={() => {
											setBillPaymentCategory({
												code: "CABLE_TV",
												name: "Cable TV",
											});
											setIsBillPaymentOpen(true);
										}}
										className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-[#1B2722] bg-[#04100B] p-2 lg:flex-row lg:justify-start lg:gap-3 lg:p-3"
									>
										<CableTvIcon className="h-5 w-5 text-white" />
										<span className="text-center font-medium text-[10px] text-white sm:text-xs lg:text-sm">
											Cable TV
										</span>
									</button>
								</li>
								<li>
									<button
										type="button"
										onClick={() => {
											setBillPaymentCategory({
												code: "ELECTRICITY",
												name: "Electricity",
											});
											setIsBillPaymentOpen(true);
										}}
										className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-[#1B2722] bg-[#04100B] p-2 lg:flex-row lg:justify-start lg:gap-3 lg:p-3"
									>
										<ElectricityIcon className="h-5 w-5 text-white" />
										<span className="text-center font-medium text-[10px] text-white sm:text-xs lg:text-sm">
											Electricity
										</span>
									</button>
								</li>
							</ul>
						</div>
					</div>
					<WalletRecentTransactions
						transactions={transactions}
						isLoading={isTransactionsLoading}
					/>
					<WalletInfo />
				</>
			)}
			{isDepositModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-[#202120]">
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-primary text-xl dark:text-white">
								Deposit Funds
							</h2>
							<button
								type="button"
								onClick={() => {
									setIsDepositModalOpen(false);
									setDepositError("");
								}}
								aria-label="Close deposit modal"
								className="cursor-pointer rounded-md px-2 py-1 text-primary text-sm dark:text-white"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<form className="mt-4 space-y-4" onSubmit={handleDepositSubmit}>
							<div>
								<label
									htmlFor="deposit-amount"
									className="mb-2 block font-medium text-primary text-sm dark:text-white"
								>
									Amount (NGN)
								</label>
								<Input
									id="deposit-amount"
									type="number"
									min={MIN_DEPOSIT_AMOUNT}
									max={MAX_DEPOSIT_AMOUNT}
									step="0.01"
									value={depositAmount}
									onChange={(event) => setDepositAmount(event.target.value)}
									placeholder="Enter amount"
								/>
								<p className="mt-2 text-[#6E6E6E] text-xs">
									Min: ₦100.00, Max: ₦9,999,999.00
								</p>
							</div>

							{depositError && (
								<p className="text-[#D13030] text-sm">{depositError}</p>
							)}

							<button
								type="submit"
								disabled={depositMutation.isPending}
								className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
							>
								{depositMutation.isPending ? "Processing..." : "Deposit"}
							</button>
						</form>
					</div>
				</div>
			)}
			<TransferModal
				isOpen={isTransferModalOpen}
				onClose={() => setIsTransferModalOpen(false)}
				onUnauthorized={() => setShouldRedirectToSignIn(true)}
			/>
			<WithdrawModal
				isOpen={isWithdrawModalOpen}
				onClose={() => setIsWithdrawModalOpen(false)}
				onUnauthorized={() => setShouldRedirectToSignIn(true)}
			/>
			{billPaymentCategory && (
				<BillPaymentModal
					isOpen={isBillPaymentOpen}
					onClose={() => {
						setIsBillPaymentOpen(false);
						setBillPaymentCategory(null);
					}}
					categoryCode={billPaymentCategory.code}
					categoryName={billPaymentCategory.name}
				/>
			)}
		</>
	);
}
