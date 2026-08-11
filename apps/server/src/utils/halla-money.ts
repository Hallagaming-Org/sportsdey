/** Halla Minigod sends/expects major NGN units; Sportsdey wallet stores kobo. */

export function nairaToKobo(naira: number): number {
	return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
	return kobo / 100;
}
