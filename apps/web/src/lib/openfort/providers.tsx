import {
	OpenfortProvider,
	RecoveryMethod,
	ThirdPartyOAuthProvider,
} from "@openfort/react";
import { getDefaultConfig, OpenfortWagmiBridge } from "@openfort/react/wagmi";
import type { PropsWithChildren } from "react";
import { polygonAmoy } from "viem/chains";
import { createConfig, WagmiProvider } from "wagmi";
import { authClient } from "@/lib/auth/client";
import {
	isOpenfortEnabled,
	OPENFORT_EVM_CHAIN_ID,
	OPENFORT_FEE_SPONSORSHIP_ID,
	OPENFORT_PUBLISHABLE_KEY,
	POLYGON_AMOY_USDC,
	SHIELD_PUBLISHABLE_KEY,
} from "@/lib/openfort/config";
import { OpenfortSessionSync } from "@/lib/openfort/session-sync";

const wagmiConfig = createConfig(
	getDefaultConfig({
		appName: "Sportsdey",
		chains: [polygonAmoy],
		walletConnectProjectId:
			import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "demo",
	}),
);

async function getBetterAuthAccessToken(): Promise<string | null> {
	const session = await authClient.getSession();
	return session?.data?.session?.token ?? null;
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
								[OPENFORT_EVM_CHAIN_ID]: [POLYGON_AMOY_USDC],
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
