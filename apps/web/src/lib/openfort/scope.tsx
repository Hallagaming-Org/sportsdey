import { useEffect, useState, type PropsWithChildren } from "react";
import { isOpenfortEnabled } from "@/lib/openfort/config";
import { OpenfortProviders } from "@/lib/openfort/providers";

/**
 * Single Openfort tree for wallet page (Crypto section + Deposit → Crypto).
 * Avoids a second provider instance that can't see wallets already created.
 */
export function OpenfortWalletScope({ children }: PropsWithChildren) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!isOpenfortEnabled() || !mounted) {
		return children;
	}

	return <OpenfortProviders>{children}</OpenfortProviders>;
}
