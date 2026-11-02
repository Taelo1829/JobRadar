CREATE TABLE `source_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`checked_at` integer NOT NULL
);
