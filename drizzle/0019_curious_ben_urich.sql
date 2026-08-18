CREATE TABLE `client_filter_presets` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` varchar(128) NOT NULL,
	`tagsJson` text NOT NULL,
	`search` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_filter_presets_id` PRIMARY KEY(`id`)
);
