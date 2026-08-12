CREATE TABLE `audit_logs` (
	`id` varchar(64) NOT NULL,
	`actor` varchar(255) NOT NULL,
	`action` varchar(255) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`code` varchar(16) NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `departments_code` PRIMARY KEY(`code`)
);
