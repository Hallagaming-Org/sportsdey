CREATE TABLE IF NOT EXISTS `bonus_engine_user_bonus` (
	`user_id` text NOT NULL,
	`bonus_id` text NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `bonus_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bonus_engine_user_bonus_user_idx` ON `bonus_engine_user_bonus` (`user_id`);--> statement-breakpoint
CREATE TABLE `kuda_transactions` (
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
CREATE UNIQUE INDEX `kuda_transactions_reference_unique` ON `kuda_transactions` (`reference`);--> statement-breakpoint
CREATE INDEX `kuda_transactions_user_id_idx` ON `kuda_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `kuda_transactions_reference_idx` ON `kuda_transactions` (`reference`);
