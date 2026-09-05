CREATE TABLE `training_flags` (
	`id` varchar(64) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`crewId` varchar(64) NOT NULL,
	`crewName` varchar(255) NOT NULL,
	`flagType` varchar(64) NOT NULL,
	`note` text NOT NULL,
	`raisedBy` varchar(255) NOT NULL,
	`raisedByUserId` int,
	`status` varchar(16) NOT NULL DEFAULT 'OPEN',
	`resolvedBy` varchar(255),
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_flags_id` PRIMARY KEY(`id`)
);
