ALTER TABLE `admin_activity_log` ADD COLUMN `session_id` text;
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `ip_address` text;
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `device` text;
--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD COLUMN `browser` text;
