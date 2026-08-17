CREATE TABLE `document_taxonomy_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_taxonomy_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_taxonomy_categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `document_taxonomy_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`categoryId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_taxonomy_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_taxonomy_tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `persisted_document_metadata` (
	`id` varchar(64) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`departmentCode` varchar(32) NOT NULL,
	`state` varchar(64) NOT NULL DEFAULT 'Required',
	`category` varchar(128),
	`tagsJson` json,
	`fileName` varchar(255),
	`fileType` varchar(128),
	`fileSize` int,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `persisted_document_metadata_id` PRIMARY KEY(`id`)
);
