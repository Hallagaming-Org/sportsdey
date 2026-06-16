export const adminPermissions = [
	"user_management",
	"transactions",
	"general",
	"view_player_details",
	"view_payouts",
	"send_notifications",
	"deactivate_account",
	"post_upload_content",
	"view_other_admins",
	"view_ticket_history",
	"reports_issues",
	"payments",
	"view_kyc_document",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

export const permissionLabels: Record<AdminPermission, string> = {
	user_management: "User management",
	transactions: "Transactions",
	general: "General",
	view_player_details: "View player details",
	view_payouts: "View payouts",
	send_notifications: "Send notifications",
	deactivate_account: "Deactivate account",
	post_upload_content: "Post/Upload content",
	view_other_admins: "View other admins",
	view_ticket_history: "View ticket history",
	reports_issues: "Reports & issues",
	payments: "Payments",
	view_kyc_document: "View KYC document",
};
