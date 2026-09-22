/**
 * Casino launch failures are often provider/session errors whose copy happens
 * to mention "balance". Those must not open the player deposit modal.
 */

export function isPlayerInsufficientFundsError(
	message: string,
	_status?: number | null,
): boolean {
	const text = message.trim();
	if (!text) return false;

	// Scorpio operator wallet / points — not the player's Sportsdey wallet.
	if (
		/balance_not_enough|point_not_enough/i.test(text) ||
		/operator.{0,60}(balance|funds|deposit)/i.test(text)
	) {
		return false;
	}

	return (
		/insufficient[_\s-]*(funds|balance|money)/i.test(text) ||
		/not enough (funds|money|balance)/i.test(text)
	);
}

export function friendlyCasinoLaunchError(message: string): string {
	if (/demo url|does not support demo|demo mode/i.test(message)) {
		return "Demo is not available for this game. Try Play Now.";
	}
	if (
		/immediate_exit|could not start|closed the session|zero limits/i.test(
			message,
		)
	) {
		return "This game is not playable yet on our Slotegrator contract. Try another title or provider.";
	}
	if (
		/balance_not_enough|point_not_enough|permission_error|currency_not_supported|under_maintenance/i.test(
			message,
		)
	) {
		return "This game is temporarily unavailable. Try another title.";
	}
	if (
		/getting player balance|retrieve(?:ing)? (?:player |wallet )?balance|fetch(?:ing)? (?:player |wallet )?balance/i.test(
			message,
		)
	) {
		return "This game could not start. Try another title or press Play again.";
	}
	return message;
}
