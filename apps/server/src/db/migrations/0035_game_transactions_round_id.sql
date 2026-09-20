ALTER TABLE `game_transactions` ADD COLUMN `round_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `game_transactions_user_round_id_idx`
	ON `game_transactions` (`user_id`, `round_id`);
