CREATE TABLE IF NOT EXISTS `admin_activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`admin_name` text NOT NULL,
	`admin_email` text NOT NULL,
	`admin_role` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_activity_log_createdAt_idx` ON `admin_activity_log` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_activity_log_adminId_idx` ON `admin_activity_log` (`admin_id`);
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `target_user_id` text;
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `target_user_name` text;
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `target_user_email` text;
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `target_user_username` text;
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `details` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_activity_log_targetUserId_idx` ON `admin_activity_log` (`target_user_id`);
