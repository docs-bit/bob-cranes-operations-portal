CREATE TABLE `client_portal_tokens` (
	`id` varchar(64) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`mobDate` varchar(64) NOT NULL,
	`offHireDate` varchar(64) NOT NULL,
	`priority` varchar(32) NOT NULL DEFAULT 'Standard',
	`createdBy` int,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_portal_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_portal_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
