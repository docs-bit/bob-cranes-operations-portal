CREATE TABLE `revoked_sessions` (
	`jti` varchar(64) NOT NULL,
	`revokedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `revoked_sessions_jti` PRIMARY KEY(`jti`)
);
--> statement-breakpoint
ALTER TABLE `persisted_document_metadata` ADD `storageKey` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` int DEFAULT 0 NOT NULL;