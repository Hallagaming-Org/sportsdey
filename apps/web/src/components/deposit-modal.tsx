// src/components/deposit-modal.tsx
import { ChevronLeft, Copy, Info, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DepositCryptoPanel } from "@/components/deposit-crypto-panel";
import { isOpenfortEnabled } from "@/lib/openfort/config";
import FlutterwaveIcon from "@/logos/flutterwave.svg?react";
import KudaIcon from "@/logos/kuda.svg?react";
import MastercardIcon from "@/logos/mastercard.svg?react";
import MoniepointIcon from "@/logos/moniepoint.svg?react";
import MonnifyIcon from "@/logos/moninify.svg?react";
import OpayIcon from "@/logos/opay.svg?react";
import PalmPayIcon from "@/logos/palmpay.svg?react";
import PaystackIcon from "@/logos/paystack.svg?react";
import WalletIcon from "@/logos/wallet.svg?react";

type DepositMethod = "card" | "direct_banking" | "bank_transfer" | "crypto";

const QUICK_AMOUNTS = [100, 200, 500, 1000, 5000, 10000];

const CARD_PROVIDER_LOGOS = [
	{ key: "opay", Icon: OpayIcon },
	{ key: "palmpay", Icon: PalmPayIcon },
	{ key: "paystack", Icon: PaystackIcon },
	{ key: "monnify", Icon: MonnifyIcon },
	{ key: "mastercard", Icon: MastercardIcon },
	{ key: "kuda", Icon: KudaIcon },
	{ key: "flutterwave", Icon: FlutterwaveIcon },
];

const BANKS = [
	{ key: "opay", name: "Opay", Icon: OpayIcon },
	{ key: "moniepoint", name: "Moniepoint", Icon: MoniepointIcon },
	{ key: "palmpay", name: "PalmPay", Icon: PalmPayIcon },
	{ key: "kuda", name: "Kuda", Icon: KudaIcon },
	{ key: "monnify", name: "Monnify", Icon: MonnifyIcon },
	{ key: "paystack", name: "Paystack", Icon: PaystackIcon },
];

/** Order matches deposit Figma: Bank Transfer → Card → Crypto → Direct Banking */
const BASE_METHOD_TABS: { key: DepositMethod; label: string }[] = [
	{ key: "bank_transfer", label: "Bank Transfer" },
	{ key: "card", label: "Card" },
	{ key: "direct_banking", label: "Direct Banking" },
];

type BankTransferDetails = {
	accountNumber: string;
	accountName: string;
	bankName: string;
	feeRange: string;
};

interface DepositModalProps {
	isOpen: boolean;
	onClose: () => void;
	amount: string;
	onAmountChange: (value: string) => void;
	onSubmit: () => void;
	isPending: boolean;
	error: string;
	walletBalance?: number;

	bankTransferDetails?: BankTransferDetails;
}

const DEFAULT_BANK_TRANSFER_DETAILS: BankTransferDetails = {
	accountNumber: "0123456789",
	accountName: "Paystack / Sportsdey-Jon",
	bankName: "Wema Bank",
	feeRange: "₦100 - ₦150",
};

export function DepositModal({
	isOpen,
	onClose,
	amount,
	onAmountChange,
	onSubmit,
	isPending,
	error,
	walletBalance,
	bankTransferDetails = DEFAULT_BANK_TRANSFER_DETAILS,
}: DepositModalProps) {
	const [activeMethod, setActiveMethod] =
		useState<DepositMethod>("bank_transfer");
	const [selectedBank, setSelectedBank] = useState<string | null>(null);
	const [cardNumber, setCardNumber] = useState("");
	const [expiry, setExpiry] = useState("");
	const [cvv, setCvv] = useState("");
	const [saveCard, setSaveCard] = useState(false);

	const methodTabs = useMemo(() => {
		if (!isOpenfortEnabled()) return BASE_METHOD_TABS;
		// Insert Crypto after Card: Bank Transfer → Card → Crypto → Direct Banking
		return [
			BASE_METHOD_TABS[0],
			BASE_METHOD_TABS[1],
			{ key: "crypto" as const, label: "Crypto" },
			BASE_METHOD_TABS[2],
		];
	}, []);

	if (!isOpen) return null;

	const selectedBankName = BANKS.find((b) => b.key === selectedBank)?.name;
	const showNairaCheckout =
		activeMethod !== "bank_transfer" && activeMethod !== "crypto";

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		onSubmit();
	};

	const handleCopyAccountNumber = () => {
		navigator.clipboard.writeText(bankTransferDetails.accountNumber);
		toast.success("Account number copied");
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-0 py-0 sm:px-4 sm:py-8">
			<div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-[#1B2722] bg-black shadow-[0_30px_60px_rgba(0,0,0,0.5)] sm:h-auto sm:max-h-[90vh] sm:rounded-[22px] sm:border">
				{/* Header */}
				<div className="flex items-center justify-between border-[#1B2722] border-b px-4 py-4 sm:px-6 sm:py-5">
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={onClose}    
							aria-label="Back" 
							className="flex h-9 w-9 cursor-pointer items-center justify-center text-white sm:hidden"
						>
							<ChevronLeft className="h-5 w-5" />
						</button>
						<div className="hidden h-11 w-11 items-center justify-center rounded-full bg-[#04100B] sm:flex">
							<WalletIcon width={20} height={20} className="text-[#4F7D42]" />
						</div>
						<h2 className="font-bold text-white text-xl sm:text-2xl">
							Deposit
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close deposit modal"
						className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#64646452] text-white transition-opacity hover:opacity-90 sm:flex"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
					{/* Deposit Method tabs */}
					<div>
						<p className="mb-3 font-semibold text-base text-white sm:text-lg">
							Deposit Method
						</p>
						<div
							className={`flex gap-2 overflow-x-auto sm:grid ${methodTabs.length > 3 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
						>
							{methodTabs.map((tab) => (
								<button
									key={tab.key}
									type="button"
									onClick={() => setActiveMethod(tab.key)}
									className={`shrink-0 rounded-lg border px-4 py-2.5 font-medium text-sm transition-colors ${activeMethod === tab.key
											? "border-accent bg-[#1BAA04] text-white"
											: "border-[#2A2B2A] bg-transparent text-[#B5B7B5] hover:bg-[#141514]"
										}`}
								>
									{tab.label}
								</button>
							))}
						</div>
					</div>

					<div className="my-5 h-px bg-[#1B2722] sm:my-6" />

							
					<form onSubmit={handleSubmit}>

						{activeMethod === "card" && (
							<>
								<div className="mb-4">
									<p className="font-semibold text-base text-white sm:text-lg">
										Payment Information
									</p>
									<p className="mt-1 text-[#8C8F8F] text-sm">
										To make purchases, enter your credit card information.
									</p>
								</div>

									<div className="scrollbar-hide mb-6 flex gap-3 overflow-x-auto pb-1">
										{CARD_PROVIDER_LOGOS.map(({ key, Icon }) => (
											<div
												key={key}
												className="flex h-11 w-24 shrink-0 items-center justify-center rounded-lg bg-white px-3"
											>
												<Icon className="h-5 max-w-full" />
											</div>
										))}
									</div>

								<div className="rounded-2xl bg-[#0A0A0A] p-4 sm:p-5">
									<div className="space-y-3 sm:flex sm:flex-row sm:items-center sm:gap-3 sm:space-y-0">
										<span className="hidden shrink-0 font-medium text-sm text-white sm:block">
											Card Info:
										</span>
										<div>
											<label className="mb-1.5 block text-[#8C8F8F] text-xs sm:hidden">
												Card Number
											</label>
											<div className="flex items-center gap-2 rounded-lg bg-[#111] px-4 py-3 sm:flex-1">
												<MastercardIcon className="h-5 w-8 shrink-0" />
												<input
													value={cardNumber}
													onChange={(e) => setCardNumber(e.target.value)}
													placeholder="0000 0000 0000 0000"
													inputMode="numeric"
													className="w-full bg-transparent text-sm text-white placeholder:text-[#6B6E6C] focus:outline-none"
												/>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-3 sm:contents">
											<div>
												<label className="mb-1.5 block text-[#8C8F8F] text-xs sm:hidden">
													Expiry Date
												</label>
												<input
													value={expiry}
													onChange={(e) => setExpiry(e.target.value)}
													placeholder="MM/YY"
													className="w-full rounded-lg bg-[#111] px-4 py-3 text-sm text-white placeholder:text-[#6B6E6C] focus:outline-none sm:w-28"
												/>
											</div>
											<div>
												<label className="mb-1.5 block text-[#8C8F8F] text-xs sm:hidden">
													CVV
												</label>
												<input
													value={cvv}
													onChange={(e) => setCvv(e.target.value)}
													placeholder="CVV"
													inputMode="numeric"
													className="w-full rounded-lg bg-[#111] px-4 py-3 text-sm text-white placeholder:text-[#6B6E6C] focus:outline-none sm:w-24"
												/>
											</div>
										</div>
									</div>

									<label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-[#B5B7B5] sm:justify-center">
										<input
											type="checkbox"
											checked={saveCard}
											onChange={(e) => setSaveCard(e.target.checked)}
											className="h-4 w-4 accent-[#17b000]"
										/>
										Save card
									</label>
								</div>
							</>
						)}

						{activeMethod === "direct_banking" && (
							<>
								<div className="mb-4 flex items-start gap-3 rounded-lg bg-[#B5B7B5] px-4 py-3">
									<Info className="mt-0.5 h-4 w-4 shrink-0 text-black" />
									<p className="text-black text-sm">
										Please ensure your wallet/account has sufficient balance to
										complete the Deposit.
									</p>
								</div>

								<p className="mb-4 text-center font-semibold text-white">
									Select a Bank
								</p>

								<div className="mb-2 rounded-2xl bg-[#040E0A] p-5">
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
										{BANKS.map(({ key, name, Icon }) => (
											<button
												key={key}
												type="button"
												onClick={() => setSelectedBank(key)}
												className={`flex flex-col cursor-pointer bg-[#151414] items-center gap-2 rounded-lg border p-2 transition-colors ${selectedBank === key
														? "border-accent"
														: "border-transparent"
													}`}
											>
												<div className="flex h-10  w-full items-center justify-center rounded-lg bg-white px-2">
													<Icon className="h-6 max-w-full" />
												</div>
												<span className="text-sm text-[#F5F5F5]">{name}</span>
											</button>
										))}
									</div>
								</div>
							</>
						)}
						{activeMethod === "bank_transfer" && (
							<>
								<div className="mb-4">
									<p className="font-semibold text-base text-white sm:text-lg">
										Naira Account Details
									</p>
									<p className="mt-1 text-[#8C8F8F] text-sm">
										Fund your wallet by making a direct transfer from any bank.
									</p>
								</div>

								<div className="mb-4 divide-y divide-[#1B2722] rounded-2xl bg-[#040E0A] px-5">
									<div className="flex items-center justify-between py-4">
										<span className="text-[#8C8F8F] text-sm">
											Account Number:
										</span>
											<span className="flex items-center gap-2 font-semibold text-white">
											{bankTransferDetails.accountNumber}
											<button
												type="button"
												onClick={handleCopyAccountNumber}
												aria-label="Copy account number"
												className="text-[#17b000] hover:opacity-80"
											>
												<Copy className="h-4 w-4" />
											</button>
										</span>
									</div>
									<div className="flex items-center justify-between py-4">
										<span className="text-[#8C8F8F] text-sm">
											Account Name:
										</span>
										<span className="font-semibold text-white">
											{bankTransferDetails.accountName}
										</span>
									</div>
									<div className="flex items-center justify-between py-4">
										<span className="text-[#8C8F8F] text-sm">Bank Name:</span>
										<span className="font-semibold text-white">
											{bankTransferDetails.bankName}
										</span>
									</div>
									<div className="flex items-center justify-between py-4">
										<span className="text-[#8C8F8F] text-sm">Fee:</span>
										<span className="font-semibold text-white">
											{bankTransferDetails.feeRange}
										</span>
									</div>
									
								</div>
							</>
						)}

						{activeMethod === "crypto" && <DepositCryptoPanel />}

				{/* Quick amounts + amount input — Naira methods only */}
						{showNairaCheckout && (
							<>
								<div className="mt-6 flex flex-wrap gap-6 justify-center">
									{QUICK_AMOUNTS.map((value) => (
										<button
											key={value}
											type="button"
											onClick={() => onAmountChange(String(value))}
											className="rounded-lg cursor-pointer bg-[#111] px-4 py-2 text-sm text-[#B5B7B5] hover:bg-[#1C1D1F]"
										>
											{value.toLocaleString("en-NG")}
										</button>
									))}
								</div>

								<div className="mt-6">
									<div className="mb-2 flex items-center justify-between">
										<span className="font-medium text-sm text-white">
											Amount:
										</span>
										{typeof walletBalance === "number" && (
											<span className="text-[#8C8F8F] text-xs">
												Wallet Balance (NGN):{" "}
												<span className="text-white">
													₦
													{walletBalance.toLocaleString("en-NG", {
														minimumFractionDigits: 2,
													})}
												</span>
											</span>
										)}
									</div>
									<div className="flex items-center justify-between rounded-lg bg-[#111] px-4 py-3">
										<span className="text-[#6B6E6C] text-sm">Amount(NGN)</span>
										<input
											value={amount}
											onChange={(e) => onAmountChange(e.target.value)}
											type="number"
											min={0}
											placeholder="0.00"
											className="w-32 bg-transparent text-right text-white text-xl focus:outline-none"
										/>
									</div>
								</div>

								{error && (
									<p className="mt-3 text-center text-[#F0668A] text-sm">
										{error}
									</p>
								)}

								<button
									type="submit"
									disabled={isPending}
									className="justify-center  mt-6 w-full  cursor-pointer rounded-lg bg-accent py-4 font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isPending
										? "Processing..." 
										: activeMethod === "direct_banking" && selectedBankName
											? `Deposit via "${selectedBankName}"`
											: "Top up now"}
								</button>
							</>
						)}

					</form>
				</div>
			</div>
		</div>
	);
}