export { getAffnookConfig, isAffnookConfigured } from "./config";
export {
	createAffnookCustomer,
	queueAffnookCustomerSync,
	recordAffnookCustomerLogin,
	type AffnookSyncOptions,
	type AffnookUserLike,
} from "./customers.service";
export type {
	AffnookApiResult,
	AffnookCreateCustomerInput,
	AffnookCustomerLoginInput,
} from "./types";
