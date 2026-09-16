CREATE TABLE IF NOT EXISTS `kuda_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reference` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'initiated' NOT NULL,
	`type` text NOT NULL,
	`beneficiary_account` text,
	`beneficiary_bank` text,
	`beneficiary_name` text,
	`narration` text,
	`kuda_reference` text,
	`raw_callback_payload` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kuda_transactions_reference_unique` ON `kuda_transactions` (`reference`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `kuda_transactions_user_id_idx` ON `kuda_transactions` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `kuda_transactions_reference_idx` ON `kuda_transactions` (`reference`);
