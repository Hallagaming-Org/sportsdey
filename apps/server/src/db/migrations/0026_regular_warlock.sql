CREATE TABLE `bonus_engine_callback_event` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`processed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bonus_engine_callback_event_idempotency_key_unique` ON `bonus_engine_callback_event` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `bonus_engine_callback_event_type_idx` ON `bonus_engine_callback_event` (`event_type`);--> statement-breakpoint
CREATE TABLE `bonus_engine_loyalty_snapshot` (
	`user_id` text PRIMARY KEY NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`loyalty_level` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bonus_engine_mission_progress` (
	`user_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`progress_percentage` real DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`reward_json` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `mission_id`)
);
--> statement-breakpoint
CREATE TABLE `sportsbook_bet_boost` (
	`id` text PRIMARY KEY NOT NULL,
	`data_bet_boost_id` text NOT NULL,
	`player_id` text,
	`boost_name` text NOT NULL,
	`description` text NOT NULL,
	`boost_percentage` real NOT NULL,
	`maximum_win` real,
	`minimum_selections` integer NOT NULL,
	`maximum_selections` integer NOT NULL,
	`minimum_odds_per_selection` real NOT NULL,
	`eligible_users` text NOT NULL,
	`eligible_sports` text NOT NULL,
	`promotion_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`promotion_id`) REFERENCES `sportsbook_promotion`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sportsbook_bet_boost_data_bet_boost_id_unique` ON `sportsbook_bet_boost` (`data_bet_boost_id`);--> statement-breakpoint
CREATE TABLE `sportsbook_promotion` (
	`id` text PRIMARY KEY NOT NULL,
	`promotion_type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`eligible_users` text NOT NULL,
	`eligible_sports` text NOT NULL,
	`competition_ids` text,
	`eligible_event_ids` text,
	`boost_percentage` real,
	`maximum_win` real,
	`minimum_selections` integer,
	`maximum_selections` integer,
	`minimum_odds_per_selection` real,
	`amount` real,
	`currency` text,
	`end_date_time` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `game` ADD `provider_id` text;--> statement-breakpoint
ALTER TABLE `game` ADD `provider_name` text;--> statement-breakpoint
ALTER TABLE `game` ADD `is_live_game` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `game` ADD `free_spin` integer DEFAULT false NOT NULL;