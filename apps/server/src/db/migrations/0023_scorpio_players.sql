CREATE TABLE `scorpio_players` (
	`user_id` text PRIMARY KEY NOT NULL,
	`player_code` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scorpio_players_playerCode_idx` ON `scorpio_players` (`player_code`);
