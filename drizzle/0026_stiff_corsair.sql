CREATE TABLE `booking_additional_requirements` (
	`id` varchar(64) NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`docName` varchar(255) NOT NULL,
	`source` varchar(16) NOT NULL DEFAULT 'DOC_SUP',
	`addedBy` int,
	`isRemoved` int NOT NULL DEFAULT 0,
	`removalReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_additional_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_certificates` (
	`id` varchar(64) NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`trainingTitle` varchar(255) NOT NULL,
	`issuedAt` varchar(10) NOT NULL,
	`expiresAt` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_bookings` (
	`id` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`clientName` varchar(255),
	`date` varchar(10) NOT NULL,
	`durationDays` int NOT NULL DEFAULT 1,
	`requiredRoles` json,
	`craneType` varchar(128),
	`notes` text,
	`colorTag` varchar(32) NOT NULL DEFAULT 'blue',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_attendees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainingId` varchar(64) NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	CONSTRAINT `training_attendees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainings` (
	`id` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`trainer` varchar(255) NOT NULL,
	`startsAt` varchar(64) NOT NULL,
	`durationMins` int,
	`location` varchar(255),
	`notes` text,
	`certificateIssued` int NOT NULL DEFAULT 0,
	`validityMonths` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `handoffNotes` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `active` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `lifting_gears` ADD `active` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `trailers` ADD `active` int DEFAULT 1 NOT NULL;