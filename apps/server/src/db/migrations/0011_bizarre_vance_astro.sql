CREATE TABLE `sportsbook_bet_event` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_id` text NOT NULL,
	`request_id` text,
	`event_type` text NOT NULL,
	`event_data` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`bet_id`) REFERENCES `sportsbook_bet`(`id`) ON UPDATE no action ON DELETE cascade
);
