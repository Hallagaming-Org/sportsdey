import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Navigate,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { Copy, Loader2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { BillPaymentModal } from "@/components/bill-payment-modal";
import { TransferModal } from "@/components/transfer-modal";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletRecentTransactions } from "@/components/wallet-recent-transactions";
import { WithdrawModal } from "@/components/withdraw-modal";
import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { formatAmount } from "@/lib/utils";
import { trackWebengageEvent } from "@/lib/webengage";
import type { WalletTransaction } from "@/lib/wallet-transactions";
import AeroplaneIcon from "@/logos/aeroplane.svg?react";
import AirtimeIcon from "@/logos/airtime.svg?react";
import CableTvIcon from "@/logos/cable-tv.svg?react";
import ElectricityIcon from "@/logos/electricity.svg?react";
import InternetIcon from "@/logos/internet.svg?react";
import WalletIcon from "@/logos/wallet.svg?react";
import { DepositModal } from "@/components/deposit-modal";

export const Route = createFileRoute("/wallet")({
	validateSearch: (search: Record<string, unknown>) => ({
		openDeposit: Boolean(search.openDeposit),
	}),
	component: WalletPage,
});

type WalletResponse = {
	id: string;
	balance?: number | null;
	createdAt: string;
	updatedAt: string;
};

type FundWalletResponse = {
	authorizationUrl: string;
	reference: string;
};

const MIN_DEPOSIT_AMOUNT = 100;
const MAX_DEPOSIT_AMOUNT = 9_999_999;

function WalletPage() {
	const showBalance = true;
	const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
	const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
	const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
	const [depositAmount, setDepositAmount] = useState("");
	const [depositError, setDepositError] = useState("");
	const [shouldRedirectToSignIn, setShouldRedirectToSignIn] = useState(false);
	const [isBillPaymentOpen, setIsBillPaymentOpen] = useState(false);
	const [blockedModal, setBlockedModal] = useState<"withdraw" | null>(null);
	const [billPaymentCategory, setBillPaymentCategory] = useState<{
		code: string;
		name: string;
	} | null>(null);
	const location = useLocation();
	const search = Route.useSearch();
	const isWalletRoot = location.pathname === "/wallet";
	useEffect(() => {
		if (search.openDeposit) {
			setIsDepositModalOpen(true);
		}
	}, [search.openDeposit]);
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
			window.location.href = data.authorizationUrl;
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
			) : isWalletRoot ? (
				<>
					<div className="mb-6 flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:gap-5">
						<div className="space-y-4 lg:col-span-3">
							<div className="flex h-fit items-center justify-between rounded-2xl border border-[#1B2722] bg-[#000606] px-5 py-4 shadow-sm">
								<h1 className="font-semibold text-[28px] text-white tracking-tight md:text-[30px]">
									Wallet
								</h1>
								<div className="flex h-10 w-14 items-center justify-center rounded-xl border border-[#1B2722] bg-[#04100B]">
									<WalletIcon
										width={18}
										height={18}
										className="block text-[#6C7073]"
									/>
								</div>
							</div>
							<div className="min-h-40 w-full rounded-2xl border border-[#1B2722] bg-[#000606] p-6 shadow-sm md:p-7">
								<p className="flex items-center gap-1.5 text-[14px] text-white">
									Wallet Balance <span aria-hidden="true">💸</span>
								</p>
								{walletData?.id && !isWalletSectionLoading && (
									<div className="mt-2 flex items-center gap-2">
										<span className="max-w-[220px] truncate font-mono text-[#6C7073] text-[12px]">
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
								<div className="mt-4">
									{isWalletSectionLoading ? (
										<Skeleton className="h-[56px] w-[200px] bg-[#1C1C1E]" />
									) : (
										<p className="font-semibold text-white leading-none">
											{showBalance ? (
												<span className="inline-flex items-baseline gap-1.5">
													<span className="text-[28px] md:text-[32px]">₦</span>
													<span className="text-[44px] tracking-tight md:text-[50px]">
														{walletBalance}
													</span>
												</span>
											) : (
												<span className="text-[50px]">••••••</span>
											)}
										</p>
									)}
								</div>
								<div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
									<button
										type="button"
										onClick={() => setIsDepositModalOpen(true)}
										className="w-full cursor-pointer rounded-xl border border-[#1B2722] bg-[#04100B] px-4 py-3 font-medium text-sm text-white transition-colors hover:border-[#2A3A34] hover:bg-[#0A1A14]"
									>
										Deposit
									</button>
									<button
										type="button"
										onClick={() => {
											setIsTransferModalOpen(true);
										}}
										className="w-full cursor-pointer rounded-xl border border-[#1B2722] bg-[#04100B] px-4 py-3 font-medium text-sm text-white transition-colors hover:border-[#2A3A34] hover:bg-[#0A1A14]"
									>
										Transfer funds
									</button>
									<button
										type="button"
										onClick={() => setBlockedModal("withdraw")}
										className="w-full cursor-pointer rounded-xl border border-[#1B2722] bg-[#04100B] px-4 py-3 font-medium text-sm text-white transition-colors hover:border-[#2A3A34] hover:bg-[#0A1A14]"
									>
										Withdraw
									</button>
								</div>
							</div>
						</div>
						<div className="min-h-40 rounded-2xl border border-[#1B2722] bg-[#000606] p-5 shadow-sm md:p-6 lg:col-span-2">
							<p className="border-[#1B2722] border-b pb-3 font-semibold text-base text-white">
								Quick Access
							</p>
							<ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-1 lg:gap-3">
								{(
									[
										{
											code: "AIRTIME",
											name: "Airtime",
											Icon: AirtimeIcon,
										},
										{
											code: "DATA_BUNDLE",
											name: "Internet",
											Icon: InternetIcon,
										},
										{
											code: "ELECTRICITY",
											name: "Electricity",
											Icon: ElectricityIcon,
										},
										{
											code: "CABLE_TV",
											name: "Cable TV",
											Icon: CableTvIcon,
										},
									] as const
								).map(({ code, name, Icon }) => (
									<li key={code}>
										<button
											type="button"
											onClick={() => {
												setBillPaymentCategory({ code, name });
												setIsBillPaymentOpen(true);
											}}
											className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-[#1B2722] bg-[#04100B] p-3 transition-colors hover:border-[#2A3A34] hover:bg-[#0A1A14] lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3.5"
										>
											<Icon className="h-5 w-5 shrink-0 text-white" />
											<span className="text-center font-medium text-xs text-white sm:text-sm">
												{name}
											</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					</div>
					<WalletRecentTransactions
						transactions={transactions}
						isLoading={isTransactionsLoading}
					/>
				</>
			) : (
				<Outlet />
			)}
			

			<DepositModal
				isOpen={isDepositModalOpen}
				onClose={() => {
					setIsDepositModalOpen(false);
					setDepositError("");
				}}
				amount={depositAmount}
				onAmountChange={setDepositAmount}
				onSubmit={handleDepositSubmit}
				isPending={depositMutation.isPending}
				error={depositError}
				walletBalance={walletData?.balance ?? undefined}
			/>


			<TransferModal
				isOpen={isTransferModalOpen}
				onClose={() => setIsTransferModalOpen(false)}
				onUnauthorized={() => setShouldRedirectToSignIn(true)}
			/>
			<WithdrawModal
				isOpen={isWithdrawModalOpen}
				onClose={() => setIsWithdrawModalOpen(false)}
				onUnauthorized={() => setShouldRedirectToSignIn(true)}
				walletBalance={walletData?.balance ?? 0}
			/>
			{blockedModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
					<div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg dark:bg-[#202120]">
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-primary text-xl dark:text-white">
								Withdraw
							</h2>
							<button
								type="button"
								onClick={() => setBlockedModal(null)}
								aria-label="Close"
								className="cursor-pointer rounded-md px-2 py-1 text-primary text-sm dark:text-white"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="mt-6 flex justify-center">
							<AeroplaneIcon className="animate-plane-fly-in h-20 w-20 text-white" />
						</div>
						<p className="mt-4 text-center font-medium text-primary text-base dark:text-white">
							Pilot mode boss.
							<br />
							Withdrawals are currently blocked
						</p>
						<button
							type="button"
							onClick={() => setBlockedModal(null)}
							className="mt-6 w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-sm text-white"
						>
							Close
						</button>
					</div>
				</div>
			)}
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
