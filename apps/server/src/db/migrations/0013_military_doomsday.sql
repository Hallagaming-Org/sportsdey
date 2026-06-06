ALTER TABLE `wallet_transaction` ADD `recipient_wallet_id` text;--> statement-breakpoint
ALTER TABLE `wallet_transaction` ADD `recipient_name` text;--> statement-breakpoint
ALTER TABLE `game` DROP COLUMN `category`;