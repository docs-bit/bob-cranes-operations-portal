CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`date` varchar(10) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'Present',
	`checkIn` varchar(5),
	`checkOut` varchar(5),
	`note` varchar(255),
	`markedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_employee_day` UNIQUE(`employeeName`,`date`)
);
