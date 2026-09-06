CREATE TABLE `progress` (
	`neptun` text NOT NULL,
	`card_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`interval_days` integer NOT NULL,
	`reviews` integer NOT NULL,
	`again_count` integer NOT NULL,
	`streak` integer NOT NULL,
	`last_rating` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`neptun`, `card_id`),
	FOREIGN KEY (`neptun`) REFERENCES `students`(`neptun`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`event_id` text PRIMARY KEY NOT NULL,
	`neptun` text NOT NULL,
	`card_id` text NOT NULL,
	`rating` text NOT NULL,
	`created_at` integer NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`neptun`) REFERENCES `students`(`neptun`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_student_time` ON `reviews` (`neptun`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`neptun` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`neptun`) REFERENCES `students`(`neptun`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `students` (
	`neptun` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen` integer NOT NULL
);
