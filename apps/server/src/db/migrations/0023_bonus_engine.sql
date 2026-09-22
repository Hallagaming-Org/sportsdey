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
CREATE TABLE `bonus_engine_user_bonus` (
	`user_id` text NOT NULL,
	`bonus_id` text NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `bonus_id`)
);
--> statement-breakpoint
CREATE INDEX `bonus_engine_user_bonus_user_idx` ON `bonus_engine_user_bonus` (`user_id`);--> statement-breakpoint
ALTER TABLE `game` ADD `provider_id` text;--> statement-breakpoint
ALTER TABLE `game` ADD `provider_name` text;--> statement-breakpoint
ALTER TABLE `game` ADD `is_live_game` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `game` ADD `free_spin` integer DEFAULT false NOT NULL;
