ALTER TABLE `game` ADD `provider_id` text;--> statement-breakpoint
ALTER TABLE `game` ADD `provider_name` text;--> statement-breakpoint
ALTER TABLE `game` ADD `is_live_game` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `game` ADD `free_spin` integer DEFAULT false NOT NULL;
