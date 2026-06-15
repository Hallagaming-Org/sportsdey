import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api";
import { formatAmount } from "@/lib/utils";

type Biller = {
	code: string;
	name: string;
	categories: { code: string; name: string }[];
};

type Product = {
	code: string;
	name: string;
	category: { code: string; name: string };
	billers: { code: string; name: string }[];
	minAmount: number | null;
	maxAmount: number | null;
	isAmountFixed: number;
	fixedAmount?: number;
	amount?: number;
	price: number;
	priceType: "OPEN" | "FIXED";
	metadata: {
		volume: number;
		duration: number;
		productType: { code: string; name: string };
		durationUnit: string;
		productCategory: string;
	};
};

type VendResponse = {
	transactionReference: string;
	paymentReference: string;
	vendReference: string;
	vendStatus: "SUCCESS" | "FAILED" | "IN_PROGRESS";
	merchantName: string;
	billerName: string;
	productName: string;
	customerId: string;
	customerName: string;
	amountPaid: number;
	vendAmount: number;
	totalAmount: number;
	commission: number;
	additionalData: Record<string, unknown>;
};

type BillPaymentModalProps = {
	isOpen: boolean;
	onClose: () => void;
	categoryCode: string;
	categoryName: string;
};

type Step = "select-biller" | "select-product" | "payment" | "success";

export function BillPaymentModal({
	isOpen,
	onClose,
	categoryCode,
	categoryName,
}: BillPaymentModalProps) {
	const [step, setStep] = useState<Step>("select-biller");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [billers, setBillers] = useState<Biller[]>([]);
	const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
	const [products, setProducts] = useState<Product[]>([]);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [customerId, setCustomerId] = useState("");
	const [amount, setAmount] = useState("");
	const [vendResult, setVendResult] = useState<VendResponse | null>(null);
	const [isVending, setIsVending] = useState(false);
	const isFixedAmountProduct = (product: Product) =>
		product.priceType !== "OPEN";

	const fetchBillers = useCallback(async () => {
		setIsLoading(true);
		setError("");
		try {
			const response = await apiRequest<{ content: Biller[] }>(
				`bills/billers?categoryCode=${categoryCode}`,
				{
					credentials: "include",
				},
			);
			setBillers(response.content);
		} catch (err) {
			setError(
				err instanceof ApiError ? err.message : "Failed to fetch billers",
			);
		} finally {
			setIsLoading(false);
		}
	}, [categoryCode]);

	const fetchProducts = useCallback(async () => {
		if (!selectedBiller) return;
		setIsLoading(true);
		setError("");
		try {
			const response = await apiRequest<{ content: Product[] }>(
				`bills/products?billerCode=${selectedBiller.code}`,
				{
					credentials: "include",
				},
			);
			console.log("products", response.content);
			setProducts(response.content);
		} catch (err) {
			setError(
				err instanceof ApiError ? err.message : "Failed to fetch products",
			);
		} finally {
			setIsLoading(false);
		}
	}, [selectedBiller]);

	useEffect(() => {
		if (isOpen && categoryCode) {
			fetchBillers();
		}
	}, [isOpen, categoryCode, fetchBillers]);

	useEffect(() => {
		if (step === "select-product" && selectedBiller) {
			fetchProducts();
		}
	}, [step, selectedBiller, fetchProducts]);

	const handleVend = async () => {
		console.log(selectedProduct);
		if (!selectedProduct || !customerId) return;
		setIsVending(true);
		setError("");
		try {
			const normalizedProductCode = selectedProduct.code?.trim();
			if (!normalizedProductCode) {
				throw new Error(
					"Invalid product selection. Please reselect a product.",
				);
			}

			const vendAmount = isFixedAmountProduct(selectedProduct)
				? (selectedProduct.price ?? Number(amount))
				: Number(amount);

			const data = await apiRequest<VendResponse>("bills/vend", {
				method: "POST",
				credentials: "include",
				body: JSON.stringify({
					productCode: normalizedProductCode,
					customerId,
					amount: vendAmount,
				}),
			});
			setVendResult(data);
			setStep("success");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Payment failed");
		} finally {
			setIsVending(false);
		}
	};

	const resetState = () => {
		setStep("select-biller");
		setError("");
		setBillers([]);
		setSelectedBiller(null);
		setProducts([]);
		setSelectedProduct(null);
		setCustomerId("");
		setAmount("");
		setVendResult(null);
	};

	const handleClose = () => {
		resetState();
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
			<div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-lg dark:bg-[#202120]">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-primary text-xl dark:text-white">
						{categoryName}
					</h2>
					<button
						type="button"
						onClick={handleClose}
						className="cursor-pointer rounded-md px-2 py-1 text-primary text-sm dark:text-white"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{error && <p className="mt-3 text-[#D13030] text-sm">{error}</p>}

				{step === "select-biller" && (
					<div className="mt-4">
						<p className="mb-3 text-primary text-sm dark:text-white">
							Select a service provider
						</p>
						{isLoading ? (
							<div className="flex justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-primary dark:text-white" />
							</div>
						) : (
							<ul className="space-y-2">
								{billers.map((biller) => (
									<li key={biller.code}>
										<button
											type="button"
											onClick={() => {
												setSelectedBiller(biller);
												setStep("select-product");
											}}
											className="w-full cursor-pointer rounded-lg border border-[#E0E0E0] p-3 text-left hover:bg-[#F0F0F0] dark:border-[#3A3A3A] dark:hover:bg-[#2A2A2A]"
										>
											<p className="font-medium text-primary dark:text-white">
												{biller.name}
											</p>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}

				{step === "select-product" && (
					<div className="mt-4">
						<p className="mb-3 text-primary text-sm dark:text-white">
							Select a product
						</p>
						{isLoading ? (
							<div className="flex justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-primary dark:text-white" />
							</div>
						) : (
							<ul className="space-y-2">
								{products.map((product) => (
									<li key={product.code}>
										<button
											type="button"
											onClick={() => {
												setSelectedProduct(product);
												if (isFixedAmountProduct(product)) {
													setAmount(String(product.price ?? 0));
												}
												setStep("payment");
											}}
											className="w-full cursor-pointer rounded-lg border border-[#E0E0E0] p-3 text-left hover:bg-[#F0F0F0] dark:border-[#3A3A3A] dark:hover:bg-[#2A2A2A]"
										>
											<p className="font-medium text-primary dark:text-white">
												{product.name}
											</p>
											<p className="text-[#6E6E6E] text-xs">
												{isFixedAmountProduct(product)
													? `₦${product.price}`
													: product.minAmount && product.maxAmount
														? `₦${product.minAmount} - ₦${product.maxAmount}`
														: "Custom amount"}
											</p>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}

				{step === "payment" && selectedProduct && (
					<div className="mt-4 space-y-4">
						<div className="rounded-lg bg-[#F0F0F0] p-3 dark:bg-[#2A2A2A]">
							<p className="text-primary text-sm dark:text-white">
								{selectedBiller?.name ?? "Biller"} - {selectedProduct.name}
							</p>
							{isFixedAmountProduct(selectedProduct) && (
								<p className="font-semibold text-lg text-primary dark:text-white">
									₦{selectedProduct.price}
								</p>
							)}
						</div>

						<div>
							<label className="mb-2 block text-primary text-sm dark:text-white">
								{["AIRTIME", "DATA", "DATA_BUNDLE", "INTERNET"].includes(
									categoryCode,
								)
									? "Phone Number"
									: categoryCode === "ELECTRICITY"
										? "Meter Number"
										: "Smartcard Number"}
							</label>
							<Input
								value={customerId}
								onChange={(e) => setCustomerId(e.target.value)}
								placeholder={
									["AIRTIME", "DATA", "DATA_BUNDLE", "INTERNET"].includes(
										categoryCode,
									)
										? "08031234567"
										: categoryCode === "ELECTRICITY"
											? "Meter number"
											: "Smartcard number"
								}
							/>
						</div>

						{!isFixedAmountProduct(selectedProduct) && (
							<div>
								<label className="mb-2 block text-primary text-sm dark:text-white">
									Amount (₦)
								</label>
								<Input
									type="number"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder="Enter amount"
									min={selectedProduct.minAmount ?? 1}
									max={selectedProduct.maxAmount ?? 999999}
								/>
								{selectedProduct.minAmount && selectedProduct.maxAmount && (
									<p className="mt-1 text-[#6E6E6E] text-xs">
										Min: ₦{selectedProduct.minAmount}, Max: ₦
										{selectedProduct.maxAmount}
									</p>
								)}
							</div>
						)}

						<button
							type="button"
							disabled={!customerId || isVending}
							onClick={handleVend}
							className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isVending
								? "Processing..."
								: `Pay ₦${
										selectedProduct.isAmountFixed === 1
											? (selectedProduct.fixedAmount ??
												selectedProduct.amount ??
												Number(amount))
											: Number(amount)
									}`}
						</button>
					</div>
				)}

				{step === "success" && vendResult && (
					<div className="mt-4 text-center">
						{vendResult.vendStatus === "SUCCESS" ? (
							<>
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#4CAF50]">
									<span className="text-2xl text-white">✓</span>
								</div>
								<h3 className="font-semibold text-lg text-primary dark:text-white">
									Payment Successful
								</h3>
								<div className="mt-4 rounded-lg bg-[#F0F0F0] p-4 text-left dark:bg-[#2A2A2A]">
									<p className="text-primary text-sm dark:text-white">
										<b>Transaction Reference:</b>{" "}
										{vendResult.transactionReference}
									</p>
									<p className="text-primary text-sm dark:text-white">
										<b>Product:</b> {vendResult.productName}
									</p>
									<p className="text-primary text-sm dark:text-white">
										<b>Amount:</b> ₦{formatAmount(vendResult.amountPaid)}
									</p>
									<p className="text-primary text-sm dark:text-white">
										<b>Customer ID:</b> {vendResult.customerId}
									</p>
								</div>
							</>
						) : (
							<>
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#D13030]">
									<span className="text-2xl text-white">✕</span>
								</div>
								<h3 className="font-semibold text-lg text-primary dark:text-white">
									Payment{" "}
									{vendResult.vendStatus === "IN_PROGRESS"
										? "In Progress"
										: "Failed"}
								</h3>
								<p className="mt-2 text-[#6E6E6E]">
									{vendResult.vendStatus === "IN_PROGRESS"
										? "Your transaction is being processed. Please check back later."
										: "Please try again or contact support."}
								</p>
							</>
						)}
						<button
							type="button"
							onClick={handleClose}
							className="mt-6 w-full cursor-pointer rounded-lg bg-primary px-4 py-2 font-medium text-sm text-white"
						>
							Close
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
