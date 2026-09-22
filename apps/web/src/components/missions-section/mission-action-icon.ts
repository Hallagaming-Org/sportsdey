import { Gamepad2, Target, Users, Wallet, type LucideIcon } from "lucide-react";
import type { MissionActionKind } from "@/lib/missions";

export function iconForAction(kind: MissionActionKind): LucideIcon {
	switch (kind) {
		case "sports":
			return Target;
		case "deposit":
			return Wallet;
		case "invite":
			return Users;
		case "casino":
		case "virtuals":
			return Gamepad2;
		default:
			return Target;
	}
}
