CREATE TABLE `dispatches` (
	`id` varchar(64) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`dispatchedBy` int,
	`sentToEmail` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'Recorded',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispatches_id` PRIMARY KEY(`id`)
);
