/** Halla Minigod sends/expects major NGN units; Sportsdey wallet stores kobo. */
import { toKobo } from "@/utils/casino-money";

export function nairaToKobo(naira: number): number {
	return toKobo(naira, "naira");
}

export function koboToNaira(kobo: number): number {
	return kobo / 100;
}
