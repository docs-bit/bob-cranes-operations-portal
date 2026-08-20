ALTER TABLE `users` ADD `localEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `departmentCode` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_localEmail_unique` UNIQUE(`localEmail`);