import {
	createContext,
	useContext,
	useEffect,
	useState,
	type PropsWithChildren,
} from "react";
import { isOpenfortEnabled } from "@/lib/openfort/config";
import { OpenfortProviders } from "@/lib/openfort/providers";

const OpenfortReadyContext = createContext(false);

/** True only when OpenfortProvider is mounted (safe to call Openfort hooks). */
export function useOpenfortReady() {
	return useContext(OpenfortReadyContext);
}

/**
 * Single Openfort tree for wallet page (Crypto section + Deposit → Crypto).
 * Children that use Openfort hooks must wait for `useOpenfortReady()`.
 */
export function OpenfortWalletScope({ children }: PropsWithChildren) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!isOpenfortEnabled()) {
		return (
			<OpenfortReadyContext.Provider value={false}>
				{children}
			</OpenfortReadyContext.Provider>
		);
	}

	if (!mounted) {
		return (
			<OpenfortReadyContext.Provider value={false}>
				{children}
			</OpenfortReadyContext.Provider>
		);
	}

	return (
		<OpenfortProviders>
			<OpenfortReadyContext.Provider value={true}>
				{children}
			</OpenfortReadyContext.Provider>
		</OpenfortProviders>
	);
}
