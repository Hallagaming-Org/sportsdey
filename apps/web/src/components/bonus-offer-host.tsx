import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BonusOfferModal } from "@/components/bonus-offer-modal";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	activatePlayerBonus,
	clearBonusOfferSession,
	fetchPlayerBonuses,
	hasBonusOfferSessionChecked,
	invalidateBonusAndWallet,
	markBonusOfferSessionChecked,
	pickReadyBonusOffer,
	readBonusOfferDismissedIds,
	writeBonusOfferDismissedIds,
	type BonusCard,
} from "@/lib/bonuses";
import {
	BONUS_OFFER_DEPOSIT_TYPES,
	BONUS_OFFER_SESSION_TYPES,
	BONUS_OFFER_TRIGGER,
	BONUS_OFFER_TRIGGER_EVENT,
	BONUS_QUERY_KEY,
	type BonusOfferTrigger,
} from "@/lib/bonuses.constant";

/** ponytail: Bonus Engine may assign the deposit bonus a few seconds after /deposit. */
const DEPOSIT_REFETCH_DELAYS_MS = [0, 3000, 8000];

type BonusOfferTriggerDetail = {
	trigger?: BonusOfferTrigger;
};

/** Maps a UI trigger to Admin `bonus_type` values the modal may activate. */
function typesForTrigger(trigger: BonusOfferTrigger): readonly string[] {
	if (trigger === BONUS_OFFER_TRIGGER.DEPOSIT) {
		return BONUS_OFFER_DEPOSIT_TYPES;
	}
	return BONUS_OFFER_SESSION_TYPES;
}

/**
 * Shows an activate modal when a welcome/login bonus is assigned after sign-in,
 * or a deposit bonus is assigned after a successful deposit.
 */
export function BonusOfferHost() {
	const location = useLocation();
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const userId = session?.user?.id ?? null;
	const previousUserId = useRef<string | null>(null);
	const [allowedTypes, setAllowedTypes] = useState<readonly string[]>([]);
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
	const [depositEpoch, setDepositEpoch] = useState(0);

	const isAuthRoute = location.pathname.startsWith("/auth");
	const isGameRoute =
		location.pathname.startsWith("/game/") ||
		location.pathname.startsWith("/play/") ||
		location.pathname === "/game-exit";
	const canPrompt = Boolean(userId) && !isAuthRoute && !isGameRoute;

	const listQuery = useQuery({
		queryKey: BONUS_QUERY_KEY.LIST,
		queryFn: fetchPlayerBonuses,
		enabled: Boolean(userId) && !isAuthRoute,
		retry: false,
	});

	const activateMutation = useMutation({
		mutationFn: activatePlayerBonus,
		onSuccess: async () => {
			toast.success("Bonus activated");
			await invalidateBonusAndWallet(queryClient);
		},
		onError: (error) => {
			toast.error(
				error instanceof ApiError
					? error.message
					: "Could not activate this bonus. Try again.",
			);
		},
	});

	useEffect(() => {
		const previous = previousUserId.current;
		if (previous && previous !== userId) {
			clearBonusOfferSession(previous);
			setAllowedTypes([]);
			setDismissedIds(new Set());
		}
		previousUserId.current = userId;
		if (!userId) return;
		setDismissedIds(readBonusOfferDismissedIds(userId));
	}, [userId]);

	useEffect(() => {
		if (!canPrompt || !userId || !listQuery.isSuccess) return;
		if (hasBonusOfferSessionChecked(userId)) return;
		markBonusOfferSessionChecked(userId);
		setAllowedTypes((current) =>
			current.length > 0 ? current : BONUS_OFFER_SESSION_TYPES,
		);
	}, [canPrompt, userId, listQuery.isSuccess]);

	useEffect(() => {
		const onTrigger = (event: Event) => {
			const detail = (event as CustomEvent<BonusOfferTriggerDetail>).detail;
			const trigger = detail?.trigger;
			if (trigger !== BONUS_OFFER_TRIGGER.DEPOSIT) return;
			setAllowedTypes(typesForTrigger(trigger));
			setDepositEpoch((epoch) => epoch + 1);
		};
		window.addEventListener(BONUS_OFFER_TRIGGER_EVENT, onTrigger);
		return () => {
			window.removeEventListener(BONUS_OFFER_TRIGGER_EVENT, onTrigger);
		};
	}, []);

	useEffect(() => {
		if (depositEpoch === 0) return;
		const timers = DEPOSIT_REFETCH_DELAYS_MS.map((delayMs) =>
			window.setTimeout(() => {
				void queryClient.invalidateQueries({ queryKey: BONUS_QUERY_KEY.LIST });
			}, delayMs),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [depositEpoch, queryClient]);

	const offer = canPrompt
		? pickReadyBonusOffer({
				bonuses: listQuery.data ?? [],
				types: allowedTypes,
				dismissedIds,
			})
		: null;

	const dismissOffer = (bonus: BonusCard) => {
		if (!userId) return;
		const next = new Set(dismissedIds);
		next.add(bonus.id);
		setDismissedIds(next);
		writeBonusOfferDismissedIds({ userId, dismissedIds: next });
	};

	if (!offer) return null;

	return (
		<BonusOfferModal
			bonus={offer}
			isActivating={
				activateMutation.isPending &&
				activateMutation.variables?.userbonusId === offer.id
			}
			onActivate={(userbonusId) => {
				activateMutation.mutate(
					{ userbonusId },
					{
						onSuccess: () => {
							dismissOffer(offer);
						},
					},
				);
			}}
			onDismiss={() => {
				dismissOffer(offer);
			}}
		/>
	);
}
