PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_wallet_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`reference` text NOT NULL,
	`status` text NOT NULL,
	`payment_method` text DEFAULT 'card' NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_wallet_transaction`("id", "user_id", "amount", "type", "reference", "status", "payment_method", "balance", "created_at") SELECT "id", "user_id", "amount", "type", "reference", "status", "payment_method", "balance", "created_at" FROM `wallet_transaction`;--> statement-breakpoint
DROP TABLE `wallet_transaction`;--> statement-breakpoint
ALTER TABLE `__new_wallet_transaction` RENAME TO `wallet_transaction`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_transaction_reference_unique` ON `wallet_transaction` (`reference`);--> statement-breakpoint
CREATE INDEX `wallet_transaction_userId_idx` ON `wallet_transaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `wallet_transaction_status_idx` ON `wallet_transaction` (`status`);--> statement-breakpoint
ALTER TABLE `admin` ADD `mobile_number` text;--> statement-breakpoint
ALTER TABLE `admin` ADD `image` text;