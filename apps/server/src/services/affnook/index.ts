export { getAffnookConfig, isAffnookConfigured } from "./config";
export {
	createAffnookCustomer,
	queueAffnookCustomerSync,
	recordAffnookCustomerLogin,
	type AffnookUserLike,
} from "./customers.service";
export type {
	AffnookApiResult,
	AffnookCreateCustomerInput,
	AffnookCustomerLoginInput,
} from "./types";
