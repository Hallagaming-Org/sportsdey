export type WalletTransaction = {
	id: string;
	userId: string;
	amount?: number | null;
	type: string;
	reference: string;
	status: string;
	paymentMethod?: string | null;
	metadata?: Record<string, unknown> | null;
	createdAt?: string | null;
	balance?: number | null;
	recipientWalletId?: string | null;
	recipientName?: string | null;
};

export type TransactionDetails = {
	title: string;
	iconType:
		| "transfer"
		| "mtn"
		| "deposit"
		| "withdrawal"
		| "electricity"
		| "airtel"
		| "default";
	statusText: "Successful" | "Pending" | "Failed";
	statusColor: "success" | "pending" | "failed";
};

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function formatTransactionDate(
	value: string | null | undefined,
): string {
	if (!value) return "Recent";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Recent";

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
}

export function formatMonthLabel(value: string): string {
	const [yearString, monthString] = value.split("-");
	const year = Number(yearString);
	const monthIndex = Number(monthString) - 1;

	if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
		return value;
	}

	const monthName = MONTH_NAMES[monthIndex] ?? value;
	return `${monthName} ${year}`;
}

export function getTransactionDetails(
	transaction: WalletTransaction,
): TransactionDetails {
	const typeLower = (transaction.type || "").toLowerCase();
	const statusLower = (transaction.status || "").toLowerCase();
	const methodLower = (transaction.paymentMethod || "").toLowerCase();
	const meta = transaction.metadata as Record<
		string,
		string | undefined
	> | null;

	let title = "Transaction";
	let iconType: TransactionDetails["iconType"] = "default";
	let statusText: TransactionDetails["statusText"] = "Pending";
	let statusColor: TransactionDetails["statusColor"] = "pending";

	if (
		statusLower === "success" ||
		statusLower === "completed" ||
		statusLower === "successful"
	) {
		statusText = "Successful";
		statusColor = "success";
	} else if (statusLower === "failed" || statusLower === "failure") {
		statusText = "Failed";
		statusColor = "failed";
	}

	if (methodLower === "wallet_transfer") {
		const isDebit =
			typeLower === "debit" || (transaction.amount && transaction.amount < 0);
		const transferType = meta?.transferType;
		if (transferType === "to_game_wallet") {
			title = "Transfer to game wallet";
			iconType = "transfer";
		} else if (isDebit) {
			title = "Transfer to friend";
			iconType = "transfer";
		} else {
			title = "Received from friend";
			iconType = "transfer";
		}
	} else if (methodLower === "crypto") {
		title = "Crypto Deposit";
		iconType = "deposit";
	} else if (
		methodLower === "card" ||
		methodLower === "paystack" ||
		methodLower === "bank transfer" ||
		methodLower === "bank_transfer"
	) {
		const isCredit =
			typeLower === "credit" || (transaction.amount && transaction.amount > 0);
		if (isCredit) {
			title = "Deposit";
			iconType = "deposit";
		} else {
			title = "Withdrawal";
			iconType = "withdrawal";
		}
	} else if (
		methodLower === "thndr games" ||
		methodLower === "lucky games" ||
		methodLower === "lagos rush" ||
		methodLower === "halla" ||
		methodLower === "slotegrator games"
	) {
		const action = meta?.action || "";
		const gameName = meta?.game || "Casino";
		if (action === "bet") {
			title = `${gameName} - Bet`;
		} else if (action === "win") {
			title = `${gameName} - Win`;
		} else if (
			action === "refund" ||
			action === "rollback" ||
			action === "reset" ||
			action === "settlement"
		) {
			title = `${gameName} - Refund`;
		} else {
			title = `${gameName} Game`;
		}
		iconType = "default";
	} else if (meta?.service) {
		const service = String(meta.service);
		if (service === "AIRTIME" || service === "DATA_BUNDLE") {
			title =
				`${meta.billerName || "Airtime/Data"} ${meta.customerId || ""}`.trim();
			iconType = "mtn";
		} else if (service === "ELECTRICITY") {
			title =
				`Electricity Bill ${meta.customerId || ""}`.trim() ||
				"Electricity Bill pay...";
			iconType = "electricity";
		} else if (service === "CABLE_TV") {
			title = `Cable TV ${meta.customerId || ""}`.trim() || "Cable TV";
			iconType = "airtel";
		} else {
			title = "Bill Payment";
			iconType = "default";
		}
	} else if (typeLower === "credit") {
		title = "Deposit";
		iconType = "deposit";
	} else {
		title = "Withdrawal";
		iconType = "withdrawal";
	}

	return { title, iconType, statusText, statusColor };
}

export function getTransactionTypeLabel(
	transaction: WalletTransaction,
): string {
	const typeLower = (transaction.type || "").toLowerCase();
	const methodLower = (transaction.paymentMethod || "").toLowerCase();
	const meta = transaction.metadata as Record<
		string,
		string | undefined
	> | null;
	const isCredit = typeLower === "credit" || (transaction.amount ?? 0) > 0;
	const isDebit = typeLower === "debit" || (transaction.amount ?? 0) < 0;

	const casinoPaymentMethods = new Set([
		"lagos rush",
		"halla",
		"lucky games",
		"lucky rise",
		"slotegrator games",
		"thndr games",
		"thundr games",
		"hashcodex",
	]);
	const sportsbookPaymentMethods = new Set(["sportsbook"]);
	const depositPaymentMethods = new Set(["opay", "kuda", "palmpay"]);

	if (methodLower === "wallet_transfer") {
		const transferDebit =
			typeLower === "debit" || (transaction.amount && transaction.amount < 0);
		if (meta?.transferType === "to_game_wallet") {
			return "Transfer to game";
		}
		return transferDebit ? "Transfer to friend" : "Received - Transfer";
	}

	if (methodLower === "crypto") {
		const asset = meta?.asset ? String(meta.asset) : "Crypto";
		return isCredit ? `Crypto Deposit · ${asset}` : `Crypto Send · ${asset}`;
	}

	if (isCredit && depositPaymentMethods.has(methodLower)) {
		return `Deposit - ${transaction.paymentMethod}`;
	}

	if (
		methodLower === "paystack" ||
		methodLower === "manual" ||
		methodLower === "card" ||
		methodLower === "bank_transfer" ||
		methodLower === "bank transfer"
	) {
		return isCredit ? "Deposit" : "Withdrawal";
	}

	if (
		meta?.serviceCategory ||
		meta?.service ||
		methodLower === "bill_payment"
	) {
		const serviceCategory = String(
			meta?.serviceCategory || meta?.service || "",
		).toLowerCase();
		const biller = meta?.billerName || "";
		const customerId = meta?.customerId || "";
		if (serviceCategory === "airtime") {
			if (biller) {
				return `${biller} Ng Airtime ${customerId}`;
			}
			return "Airtime Bill payment";
		}
		if (serviceCategory === "data") {
			if (biller) {
				return `${biller} Ng Data ${customerId}`;
			}
			return "Data Bill payment";
		}
		if (serviceCategory === "electricity") {
			return "Electricity Bill payment";
		}
		if (serviceCategory === "cable_tv") {
			return "Cable Bill payment";
		}
		if (!serviceCategory && methodLower === "bill_payment") {
			return "Bill Payment";
		}
	}

	if (casinoPaymentMethods.has(methodLower)) {
		return isDebit ? "Debit - Casino" : "Credit - Casino";
	}

	if (sportsbookPaymentMethods.has(methodLower)) {
		return isDebit ? "Debit - Sportsbook" : "Credit - Sportsbook";
	}

	const paymentMethod = transaction.paymentMethod || "Unknown";
	if (isCredit) {
		return `Winnings - ${paymentMethod}`;
	}
	return `Loss - ${paymentMethod}`;
}

function truncateReceiptId(id: string): string {
	if (id.length <= 16) return id;
	return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatNairaAmount(amount: number, signed = false): string {
	const abs = Math.abs(amount);
	const formatted = `₦${abs.toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
	if (signed && amount < 0) return `- ${formatted}`;
	return formatted;
}

/** Receipt rows matching the Figma Transaction Details modal. */
export function getWalletReceiptDetails(tx: WalletTransaction): Array<{
	label: string;
	value: string;
	copyable?: boolean;
	copyValue?: string;
}> {
	const { iconType } = getTransactionDetails(tx);
	const meta = (tx.metadata ?? {}) as Record<
		string,
		string | number | undefined
	>;
	const methodLower = (tx.paymentMethod || "").toLowerCase();
	const txId = String(tx.reference || tx.id);
	const details: Array<{
		label: string;
		value: string;
		copyable?: boolean;
		copyValue?: string;
	}> = [];

	if (methodLower === "crypto") {
		details.push({ label: "Transaction Type", value: "Crypto Deposit" });
		details.push({
			label: "Amount",
			value: String(meta.amountLabel || `${tx.amount ?? 0}`),
		});
		details.push({ label: "Asset", value: String(meta.asset || "Crypto") });
		details.push({
			label: "Network",
			value: String(meta.network || "Crypto"),
		});
		if (meta.from) {
			const from = String(meta.from);
			details.push({
				label: "From",
				value: truncateReceiptId(from),
				copyable: true,
				copyValue: from,
			});
		}
		details.push({
			label: "Date",
			value: formatTransactionDate(tx.createdAt),
		});
		details.push({
			label: "Transaction ID",
			value: truncateReceiptId(txId),
			copyable: true,
			copyValue: txId,
		});
		return details;
	}

	if (iconType === "transfer") {
		const transferType = meta.transferType;
		if (transferType === "outgoing") {
			details.push({
				label: "Recipient Name",
				value: String(meta.recipientName || "N/A"),
			});
			details.push({
				label: "Recipient Wallet ID",
				value: truncateReceiptId(String(meta.recipientWalletId || "N/A")),
				copyable: true,
				copyValue: String(meta.recipientWalletId || ""),
			});
		} else if (transferType === "incoming") {
			details.push({
				label: "Sender Name",
				value: String(meta.senderName || "N/A"),
			});
			details.push({
				label: "Sender Wallet ID",
				value: truncateReceiptId(String(meta.senderWalletId || "N/A")),
				copyable: true,
				copyValue: String(meta.senderWalletId || ""),
			});
		}
		details.push({
			label: "Amount",
			value: formatNairaAmount(tx.amount || 0),
		});
		details.push({ label: "Fee", value: "₦0" });
		details.push({
			label: "Date",
			value: formatTransactionDate(tx.createdAt),
		});
		details.push({ label: "Transaction Type", value: "Transfer" });
	} else if (
		iconType === "mtn" ||
		iconType === "airtel" ||
		iconType === "electricity"
	) {
		details.push({
			label: "To",
			value: meta.customerId
				? `${meta.customerId} (${meta.billerName || ""})`
				: "Utility Bill",
		});
		details.push({
			label: "Amount",
			value: formatNairaAmount(-Math.abs(tx.amount || 0), true),
		});
		details.push({ label: "Fee", value: "₦0" });
		details.push({
			label: "Description",
			value: meta.service ? `${meta.service} Purchase` : "Bill Payment",
		});
		details.push({
			label: "Date",
			value: formatTransactionDate(tx.createdAt),
		});
		details.push({ label: "Transaction Type", value: "Bills" });
	} else if (iconType === "deposit") {
		const fee =
			typeof meta.fees === "number"
				? formatNairaAmount(meta.fees)
				: typeof meta.fees === "string" && meta.fees
					? `₦${meta.fees}`
					: "₦0";
		details.push({ label: "Transaction Type", value: "Credit (Deposit)" });
		details.push({
			label: "Amount",
			value: formatNairaAmount(Math.abs(tx.amount || 0)),
		});
		details.push({ label: "Fee", value: fee });
		if (meta.provider) {
			details.push({ label: "Provider", value: String(meta.provider) });
		}
		if (meta.cardLast4) {
			details.push({
				label: "Card",
				value: `${String(meta.cardType || "Card").toUpperCase()} ****${meta.cardLast4}`,
			});
		}
		details.push({
			label: "Date",
			value: formatTransactionDate(tx.createdAt),
		});
	} else {
		details.push({ label: "Transaction Type", value: "Debit (Withdrawal)" });
		details.push({
			label: "Amount",
			value: formatNairaAmount(-Math.abs(tx.amount || 0), true),
		});
		details.push({ label: "Fee", value: "₦0" });
		details.push({
			label: "Date",
			value: formatTransactionDate(tx.createdAt),
		});
	}

	details.push({
		label: "Transaction ID",
		value: truncateReceiptId(txId),
		copyable: true,
		copyValue: txId,
	});
	return details;
}

export type WalletTransactionsMonthGroup = {
	monthKey: string;
	label: string;
	transactions: WalletTransaction[];
};

function toMonthKey(date: Date): string {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function groupTransactionsByMonth(
	transactions: WalletTransaction[],
): WalletTransactionsMonthGroup[] {
	const sortedTransactions = [...transactions].sort((a, b) => {
		const aTime = new Date(a.createdAt || "").getTime();
		const bTime = new Date(b.createdAt || "").getTime();
		return bTime - aTime;
	});

	const groups = new Map<string, WalletTransaction[]>();

	for (const transaction of sortedTransactions) {
		const createdAt = new Date(transaction.createdAt || "");
		if (Number.isNaN(createdAt.getTime())) {
			continue;
		}

		const monthKey = toMonthKey(createdAt);
		const existingTransactions = groups.get(monthKey) ?? [];
		existingTransactions.push(transaction);
		groups.set(monthKey, existingTransactions);
	}

	return [...groups.entries()]
		.map(([monthKey, groupedTransactions]) => ({
			monthKey,
			label: formatMonthLabel(monthKey),
			transactions: groupedTransactions,
		}))
		.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
