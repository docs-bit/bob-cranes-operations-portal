CREATE TABLE `runtime_error_events` (
	`id` varchar(64) NOT NULL,
	`source` varchar(32) NOT NULL,
	`message` varchar(1000) NOT NULL,
	`path` varchar(512) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `runtime_error_events_id` PRIMARY KEY(`id`)
);
