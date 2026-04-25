ALTER TABLE `wallet_transaction` ADD `payment_method` text DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE `wallet_transaction` ADD `balance` integer DEFAULT 0 NOT NULL;