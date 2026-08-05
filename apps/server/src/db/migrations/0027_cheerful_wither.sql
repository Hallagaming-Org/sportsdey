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
ALTER TABLE `sportsbook_bet_boost` ADD `promotion_id` text REFERENCES sportsbook_promotion(id);
