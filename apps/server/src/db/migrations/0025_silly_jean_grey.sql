CREATE TABLE `opay_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reference` text NOT NULL,
	`order_no` text,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'initiated' NOT NULL,
	`cashier_url` text,
	`raw_callback_payload` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opay_transaction_reference_unique` ON `opay_transaction` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `opay_transaction_order_no_unique` ON `opay_transaction` (`order_no`);--> statement-breakpoint
CREATE INDEX `opay_transaction_userId_idx` ON `opay_transaction` (`user_id`);--> statement-breakpoint
