ALTER TABLE `rental_enquiries` ADD `assignedToUserId` int;--> statement-breakpoint
ALTER TABLE `rental_enquiries` ADD `convertedBookingId` varchar(64);--> statement-breakpoint
ALTER TABLE `rental_enquiries` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;