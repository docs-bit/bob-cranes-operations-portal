CREATE TABLE `department_dashboards` (
	`departmentCode` varchar(16) NOT NULL,
	`description` text NOT NULL,
	`accent` varchar(32) NOT NULL DEFAULT 'orange',
	`icon` varchar(48) NOT NULL DEFAULT 'LayoutDashboard',
	`dashboardConfig` json NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `department_dashboards_departmentCode` PRIMARY KEY(`departmentCode`)
);
