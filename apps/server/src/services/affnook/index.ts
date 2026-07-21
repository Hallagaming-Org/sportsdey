export { getAffnookConfig, isAffnookConfigured } from "./config";
export {
	createAffnookCustomer,
	recordAffnookCustomerLogin,
} from "./customers.service";
export type {
	AffnookApiResult,
	AffnookCreateCustomerInput,
	AffnookCustomerLoginInput,
} from "./types";
