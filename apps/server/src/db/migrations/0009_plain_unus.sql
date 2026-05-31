CREATE TABLE `sportsbook_bet_boost` (
	`id` text PRIMARY KEY NOT NULL,
	`data_bet_boost_id` text,
	`user_id` text NOT NULL,
	`calculation_strategy` text,
	`conditions` text,
	`expires_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sportsbook_bet_boost_data_bet_boost_id_unique` ON `sportsbook_bet_boost` (`data_bet_boost_id`);--> statement-breakpoint
CREATE TABLE `sportsbook_freebet` (
	`id` text PRIMARY KEY NOT NULL,
	`data_bet_freebet_id` text,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`expired_at` integer,
	`conditions` text,
	`status` text DEFAULT 'active' NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sportsbook_freebet_data_bet_freebet_id_unique` ON `sportsbook_freebet` (`data_bet_freebet_id`);