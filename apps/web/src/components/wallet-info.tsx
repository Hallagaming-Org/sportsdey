export function WalletInfo() {
	return (
		<div className="mt-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-[#202120]">
			<ol className="list-decimal space-y-4 pl-6 text-[14px] text-primary dark:text-white">
				<li>
					Minimum deposit amount is NGN 100.00 - you can deposit at least NGN
					100.00 in one transaction.
				</li>
				<li>
					Maximum per transaction is NGN 9,999,999.00 - you can deposit up to
					NGN 9,999,999.00 in one transaction.
				</li>
				<li>
					Any card details you choose to save are encrypted. We do not store your
					CVV. We will also ask you to input your Sportsdey PIN any time you want to
					use your card after it has been successfully used for the first time and
					saved.
				</li>
				<li>
					We do not share your payment information. It is used for transaction
					verification only.
				</li>
				<li>
					If you have any issues, please contact customer service. Using too many
					cards or bank accounts for deposits may cause the deposit to be blocked
					and your account restricted.
				</li>
				<li>Deposit is free, there are no transaction fees.</li>
			</ol>
		</div>
	);
}
