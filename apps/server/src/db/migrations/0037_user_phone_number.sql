CREATE TABLE IF NOT EXISTS `user_phone_number` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone_e164` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_phone_number_phone_e164_uidx` ON `user_phone_number` (`phone_e164`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_phone_number_userId_idx` ON `user_phone_number` (`user_id`);
