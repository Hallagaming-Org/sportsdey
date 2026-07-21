export type AffnookCreateCustomerInput = {
	customerId: string;
	customerName: string;
	email?: string;
	currency?: string;
	brandId?: string;
	productId?: string;
	trackingToken?: string;
	country?: string;
	promocode?: string;
	timestamp?: number;
	ip?: string;
	city?: string;
	region?: string;
};

export type AffnookCustomerLoginInput = {
	customerId: string;
	browser?: string;
	os?: string;
	ip?: string;
	country?: string;
	city?: string;
	region?: string;
	userAgent?: string;
	timestamp?: number;
};

export type AffnookApiResult<T = unknown> = {
	ok: boolean;
	status: number;
	data?: T;
	error?: string;
	message?: string;
};
