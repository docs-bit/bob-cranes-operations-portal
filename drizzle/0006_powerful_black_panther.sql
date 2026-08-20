ALTER TABLE `users` MODIFY COLUMN `role` enum('user','supervisor','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `supervisorId` int;