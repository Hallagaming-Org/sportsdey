ALTER TABLE `pockets_transactions` ADD COLUMN `provider` text;
--> statement-breakpoint
ALTER TABLE `pockets_transactions` ADD COLUMN `game_code` text;
--> statement-breakpoint
ALTER TABLE `pockets_transactions` ADD COLUMN `round_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pockets_transactions_user_round_id_idx`
	ON `pockets_transactions` (`user_id`, `round_id`);
