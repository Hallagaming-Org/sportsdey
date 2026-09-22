import {
	OpenfortProvider,
	RecoveryMethod,
	ThirdPartyOAuthProvider,
} from "@openfort/react";
import { getDefaultConfig, OpenfortWagmiBridge } from "@openfort/react/wagmi";
import type { PropsWithChildren } from "react";
import { createConfig, WagmiProvider } from "wagmi";
import { getBetterAuthSessionToken } from "@/lib/auth/client";
import {
	isOpenfortEnabled,
	OPENFORT_EVM_CHAIN_ID,
	OPENFORT_FEE_SPONSORSHIP_ID,
	OPENFORT_PUBLISHABLE_KEY,
	OPENFORT_STABLECOIN_ADDRESS,
	OPENFORT_VIEM_CHAIN,
	SHIELD_PUBLISHABLE_KEY,
} from "@/lib/openfort/config";
import { OpenfortSessionSync } from "@/lib/openfort/session-sync";

const wagmiConfig = createConfig(
	getDefaultConfig({
		appName: "Sportsdey",
		chains: [OPENFORT_VIEM_CHAIN],
		walletConnectProjectId:
			import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "demo",
	}),
);

async function getBetterAuthAccessToken(): Promise<string | null> {
	return getBetterAuthSessionToken();
}

export function OpenfortProviders({ children }: PropsWithChildren) {
	if (
		!isOpenfortEnabled() ||
		!OPENFORT_PUBLISHABLE_KEY ||
		!SHIELD_PUBLISHABLE_KEY
	) {
		return children;
	}

	return (
		<WagmiProvider config={wagmiConfig}>
			<OpenfortWagmiBridge>
				<OpenfortProvider
					publishableKey={OPENFORT_PUBLISHABLE_KEY}
					thirdPartyAuth={{
						provider: ThirdPartyOAuthProvider.BETTER_AUTH,
						getAccessToken: getBetterAuthAccessToken,
					}}
					walletConfig={{
						shieldPublishableKey: SHIELD_PUBLISHABLE_KEY,
						ethereum: {
							chainId: OPENFORT_EVM_CHAIN_ID,
							assets: {
								[OPENFORT_EVM_CHAIN_ID]: [OPENFORT_STABLECOIN_ADDRESS],
							},
							...(OPENFORT_FEE_SPONSORSHIP_ID
								? {
										ethereumFeeSponsorshipId: OPENFORT_FEE_SPONSORSHIP_ID,
									}
								: {}),
						},
						connectOnLogin: true,
					}}
					uiConfig={{
						walletRecovery: {
							defaultMethod: RecoveryMethod.PASSKEY,
							allowedMethods: [RecoveryMethod.PASSKEY],
						},
					}}
				>
					<OpenfortSessionSync />
					{children}
				</OpenfortProvider>
			</OpenfortWagmiBridge>
		</WagmiProvider>
	);
}
