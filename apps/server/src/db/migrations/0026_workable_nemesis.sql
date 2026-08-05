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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sportsbook_bet_boost_data_bet_boost_id_unique` ON `sportsbook_bet_boost` (`data_bet_boost_id`);