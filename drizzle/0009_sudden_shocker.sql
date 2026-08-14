CREATE TABLE `client_feedback` (
	`id` varchar(64) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`category` varchar(32) NOT NULL DEFAULT 'Bug report',
	`message` text NOT NULL,
	`contactEmail` varchar(320),
	`status` varchar(32) NOT NULL DEFAULT 'Open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_feedback_id` PRIMARY KEY(`id`)
);
