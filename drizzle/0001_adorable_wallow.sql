CREATE TABLE `bookings` (
	`id` varchar(64) NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`projectManager` varchar(255) NOT NULL,
	`lpoReference` varchar(128) NOT NULL,
	`mobilizationDate` varchar(64) NOT NULL,
	`offHireDate` varchar(64) NOT NULL,
	`clientContactName` varchar(255) NOT NULL,
	`clientEmail` varchar(320) NOT NULL,
	`clientPhone` varchar(64) NOT NULL,
	`priority` varchar(32) NOT NULL DEFAULT 'Standard',
	`stage` varchar(128) NOT NULL DEFAULT 'Created by Salesperson',
	`craneId` varchar(64),
	`crewIds` json,
	`gearIds` json,
	`trailerIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` varchar(64) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`team` varchar(128) NOT NULL,
	`sender` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crew` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`designation` varchar(128) NOT NULL,
	`availability` varchar(64) NOT NULL DEFAULT 'Present',
	`certificateExpiry` varchar(64) NOT NULL,
	`trainingRequired` int NOT NULL DEFAULT 0,
	CONSTRAINT `crew_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` varchar(64) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`departmentCode` varchar(16) NOT NULL,
	`name` varchar(255) NOT NULL,
	`state` varchar(64) NOT NULL DEFAULT 'Required',
	`expiryDate` varchar(64),
	`required` int NOT NULL DEFAULT 1,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` varchar(64) NOT NULL,
	`assetCode` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`capacityTons` int NOT NULL DEFAULT 50,
	`status` varchar(32) NOT NULL DEFAULT 'Available',
	`inspectionExpiry` varchar(64) NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'Mobile Crane',
	`registration` varchar(64),
	CONSTRAINT `equipment_id` PRIMARY KEY(`id`),
	CONSTRAINT `equipment_assetCode_unique` UNIQUE(`assetCode`)
);
--> statement-breakpoint
CREATE TABLE `lifting_gears` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`gearType` varchar(64) NOT NULL DEFAULT 'Shackle',
	`swlTons` int NOT NULL DEFAULT 10,
	`inspectionExpiry` varchar(64) NOT NULL,
	CONSTRAINT `lifting_gears_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(64) NOT NULL,
	`departmentCode` varchar(16) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`read` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trailers` (
	`id` varchar(64) NOT NULL,
	`plateNumber` varchar(64) NOT NULL,
	`trailerType` varchar(64) NOT NULL DEFAULT 'Flatbed',
	`status` varchar(64) NOT NULL DEFAULT 'Available',
	CONSTRAINT `trailers_id` PRIMARY KEY(`id`)
);
