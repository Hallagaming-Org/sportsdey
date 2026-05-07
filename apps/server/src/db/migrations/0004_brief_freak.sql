CREATE TABLE `kyc` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`identification_type` text NOT NULL,
	`front_document_id` text,
	`back_document_id` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`rejection_reason` text,
	`submitted_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`front_document_id`) REFERENCES `user_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`back_document_id`) REFERENCES `user_file`(`id`) ON UPDATE no action ON DELETE no action
);
