CREATE TABLE `sportsbook_bet` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text,
	`user_id` text NOT NULL,
	`stake` integer NOT NULL,
	`total_odds_value` text,
	`bet_type` integer,
	`bet_freebet_id` text,
	`status` text NOT NULL,
	`settle_amount` integer,
	`settle_type` integer,
	`bet_data` text,
	`cash_out_order_ids` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sportsbook_bet_request_id_unique` ON `sportsbook_bet` (`request_id`);--> statement-breakpoint
ALTER TABLE `wallet` ADD `frozen_balance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `wallet_transaction` DROP COLUMN `balance`;