CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `tokenHash` varchar(128) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_sessions_tokenHash_unique` (`tokenHash`)
);
