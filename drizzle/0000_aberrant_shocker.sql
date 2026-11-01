CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_id` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`url` text NOT NULL,
	`description` text NOT NULL,
	`found_at` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`applied_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watches` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`board` text DEFAULT '' NOT NULL,
	`last_check` integer,
	`message` text DEFAULT 'Waiting for first check' NOT NULL
);
