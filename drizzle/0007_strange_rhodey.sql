CREATE TABLE `booking_crew_allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` varchar(64) NOT NULL,
	`crewId` varchar(64) NOT NULL,
	`crewName` varchar(255) NOT NULL,
	`assignedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_crew_allocations_id` PRIMARY KEY(`id`)
);
