CREATE TABLE IF NOT EXISTS `client_portal_tokens` (
  `id` varchar(64) NOT NULL,
  `bookingId` varchar(64) NOT NULL,
  `token` varchar(128) NOT NULL,
  `channel` varchar(16) NOT NULL DEFAULT 'magic_link',
  `otp` varchar(8),
  `email` varchar(320) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_portal_tokens_token_unique` (`token`)
);
