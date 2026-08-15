CREATE TABLE `department_workflow_templates` (
	`id` varchar(64) NOT NULL,
	`departmentCode` varchar(16) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`checklist` json NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `department_workflow_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rental_enquiries` (
	`id` varchar(64) NOT NULL,
	`contactName` varchar(160) NOT NULL,
	`companyName` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(48) NOT NULL,
	`projectLocation` varchar(255) NOT NULL,
	`equipmentInterest` varchar(120) NOT NULL,
	`liftDetails` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'New',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rental_enquiries_id` PRIMARY KEY(`id`)
);
