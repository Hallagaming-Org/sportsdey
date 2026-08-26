CREATE TABLE `bonus_engine_user_bonus` (
	`user_id` text NOT NULL,
	`bonus_id` text NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `bonus_id`)
);
--> statement-breakpoint
CREATE INDEX `bonus_engine_user_bonus_user_idx` ON `bonus_engine_user_bonus` (`user_id`);
