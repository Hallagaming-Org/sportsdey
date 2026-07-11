ALTER TABLE `game_transactions` ADD `balance_before` integer;--> statement-breakpoint
ALTER TABLE `game_transactions` ADD `balance_after` integer;--> statement-breakpoint
ALTER TABLE `pockets_transactions` ADD `balance_before` integer;--> statement-breakpoint
ALTER TABLE `pockets_transactions` ADD `balance_after` integer;--> statement-breakpoint
ALTER TABLE `slotitegration_transactions` ADD `balance_before` integer;--> statement-breakpoint
ALTER TABLE `slotitegration_transactions` ADD `balance_after` integer;--> statement-breakpoint
ALTER TABLE `sportsbook_bet_event` ADD `balance_before` integer;--> statement-breakpoint
ALTER TABLE `sportsbook_bet_event` ADD `balance_after` integer;--> statement-breakpoint
ALTER TABLE `thundr_transactions` ADD `balance_before` integer;--> statement-breakpoint
ALTER TABLE `thundr_transactions` ADD `balance_after` integer;