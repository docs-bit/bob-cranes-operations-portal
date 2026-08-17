CREATE TABLE `rental_enquiry_events` (
	`id` varchar(64) NOT NULL,
	`rentalEnquiryId` varchar(64) NOT NULL,
	`actorUserId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`summary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rental_enquiry_events_id` PRIMARY KEY(`id`)
);
