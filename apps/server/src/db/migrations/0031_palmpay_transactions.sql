CREATE TABLE IF NOT EXISTS `palmpay_transaction` (
 `id` text PRIMARY KEY NOT NULL,
 `user_id` text NOT NULL,
 `reference` text NOT NULL,
 `order_no` text,
 `amount` integer NOT NULL,
 `status` text DEFAULT 'initiated' NOT NULL,
 `checkout_url` text,
 `raw_callback_payload` text,
 `created_at` integer NOT NULL,
 `updated_at` integer NOT NULL,
 FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `palmpay_transaction_reference_unique` ON `palmpay_transaction` (`reference`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `palmpay_transaction_order_no_unique` ON `palmpay_transaction` (`order_no`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `palmpay_transaction_user_id_idx` ON `palmpay_transaction` (`user_id`);
