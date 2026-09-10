CREATE TABLE IF NOT EXISTS `opay_transaction` (
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
CREATE UNIQUE INDEX IF NOT EXISTS `opay_transaction_reference_unique` ON `opay_transaction` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `opay_transaction_order_no_unique` ON `opay_transaction` (`order_no`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `opay_transaction_userId_idx` ON `opay_transaction` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scorpio_players` (
	`user_id` text PRIMARY KEY NOT NULL,
	`player_code` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `scorpio_players_playerCode_idx` ON `scorpio_players` (`player_code`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scorpio_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`reference_id` text,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_before` integer,
	`balance_after` integer,
	`round_id` text NOT NULL,
	`provider_id` integer,
	`game_code` text,
	`currency` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `scorpio_transactions_transaction_id_unique` ON `scorpio_transactions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `scorpio_tx_userId_idx` ON `scorpio_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `scorpio_tx_referenceId_idx` ON `scorpio_transactions` (`reference_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `scorpio_tx_roundId_idx` ON `scorpio_transactions` (`round_id`);
