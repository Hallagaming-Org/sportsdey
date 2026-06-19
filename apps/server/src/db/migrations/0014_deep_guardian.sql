CREATE TABLE `admin_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text NOT NULL,
	`reference_id` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admin`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- ALTER TABLE `wallet_transaction` ADD `metadata` text;
