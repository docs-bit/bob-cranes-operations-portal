CREATE TABLE `telemetry_events` (
	`id` varchar(64) NOT NULL,
	`metricName` varchar(64) NOT NULL,
	`metricValue` varchar(64) NOT NULL,
	`path` varchar(512) NOT NULL,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telemetry_events_id` PRIMARY KEY(`id`)
);
