ALTER TABLE `watches` ADD `tracking_since` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `watches` ADD `last_match_at` integer;--> statement-breakpoint
ALTER TABLE `watches` ADD `stale_at` integer;
--> statement-breakpoint
UPDATE watches SET tracking_since = CAST(strftime('%s','now') AS INTEGER)*1000;
