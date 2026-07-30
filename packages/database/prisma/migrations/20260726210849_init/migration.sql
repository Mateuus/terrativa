-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `username` VARCHAR(40) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('USER', 'MODERATOR', 'ADMIN') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `emailVerifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_username_key`(`username`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserProfile` (
    `userId` CHAR(36) NOT NULL,
    `displayName` VARCHAR(80) NOT NULL,
    `avatarKey` VARCHAR(120) NULL,
    `locale` VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSession` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `tokenFamilyId` CHAR(36) NOT NULL,
    `userAgentHash` CHAR(64) NULL,
    `ipHash` CHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `rotatedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserSession_tokenHash_key`(`tokenHash`),
    INDEX `UserSession_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `UserSession_tokenFamilyId_idx`(`tokenFamilyId`),
    INDEX `UserSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Theme` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Theme_slug_key`(`slug`),
    INDEX `Theme_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Board` (
    `id` CHAR(36) NOT NULL,
    `themeId` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `tileCount` INTEGER NOT NULL,
    `startingBalance` INTEGER NOT NULL,
    `passStartReward` INTEGER NOT NULL,
    `rulesJson` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Board_slug_key`(`slug`),
    INDEX `Board_themeId_status_idx`(`themeId`, `status`),
    UNIQUE INDEX `Board_themeId_slug_key`(`themeId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BoardTile` (
    `id` CHAR(36) NOT NULL,
    `boardId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `type` ENUM('START', 'PROPERTY', 'TRANSPORT', 'UTILITY', 'REGIONAL_EVENT', 'COMMUNITY_BENEFIT', 'MUNICIPAL_FEE', 'INSPECTION', 'VISITING', 'REST', 'MOVE') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NOT NULL,
    `assetKey` VARCHAR(160) NULL,
    `configJson` JSON NOT NULL,

    INDEX `BoardTile_boardId_type_idx`(`boardId`, `type`),
    UNIQUE INDEX `BoardTile_boardId_position_key`(`boardId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyGroup` (
    `id` CHAR(36) NOT NULL,
    `boardId` CHAR(36) NOT NULL,
    `key` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `color` CHAR(7) NOT NULL,
    `upgradeCost` INTEGER NOT NULL,
    `maxLevel` INTEGER NOT NULL DEFAULT 4,

    UNIQUE INDEX `PropertyGroup_boardId_key_key`(`boardId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyDefinition` (
    `id` CHAR(36) NOT NULL,
    `tileId` CHAR(36) NOT NULL,
    `groupId` CHAR(36) NOT NULL,
    `purchasePrice` INTEGER NOT NULL,
    `mortgageValue` INTEGER NOT NULL,
    `unmortgageCost` INTEGER NOT NULL,
    `rentByLevel` JSON NOT NULL,

    UNIQUE INDEX `PropertyDefinition_tileId_key`(`tileId`),
    INDEX `PropertyDefinition_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardDeck` (
    `id` CHAR(36) NOT NULL,
    `boardId` CHAR(36) NOT NULL,
    `type` ENUM('REGIONAL_EVENT', 'COMMUNITY_BENEFIT') NOT NULL,
    `name` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `CardDeck_boardId_type_key`(`boardId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardDefinition` (
    `id` CHAR(36) NOT NULL,
    `deckId` CHAR(36) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `publicText` TEXT NOT NULL,
    `effectType` VARCHAR(80) NOT NULL,
    `effectConfigJson` JSON NOT NULL,
    `tradable` BOOLEAN NOT NULL DEFAULT false,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CardDefinition_deckId_enabled_idx`(`deckId`, `enabled`),
    UNIQUE INDEX `CardDefinition_deckId_key_key`(`deckId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Room` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(12) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `ownerUserId` CHAR(36) NOT NULL,
    `boardId` CHAR(36) NOT NULL,
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `passwordHash` VARCHAR(255) NULL,
    `minPlayers` INTEGER NOT NULL DEFAULT 2,
    `maxPlayers` INTEGER NOT NULL DEFAULT 6,
    `turnDurationSeconds` INTEGER NOT NULL DEFAULT 60,
    `allowSpectators` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('OPEN', 'STARTING', 'STARTED', 'CLOSED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Room_code_key`(`code`),
    INDEX `Room_status_visibility_createdAt_idx`(`status`, `visibility`, `createdAt`),
    INDEX `Room_ownerUserId_idx`(`ownerUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomMember` (
    `id` CHAR(36) NOT NULL,
    `roomId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `role` ENUM('HOST', 'PLAYER', 'SPECTATOR') NOT NULL DEFAULT 'PLAYER',
    `pawnKey` VARCHAR(80) NULL,
    `colorKey` VARCHAR(40) NULL,
    `ready` BOOLEAN NOT NULL DEFAULT false,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    INDEX `RoomMember_userId_leftAt_idx`(`userId`, `leftAt`),
    UNIQUE INDEX `RoomMember_roomId_userId_key`(`roomId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Game` (
    `id` CHAR(36) NOT NULL,
    `roomId` CHAR(36) NOT NULL,
    `boardId` CHAR(36) NOT NULL,
    `boardVersion` INTEGER NOT NULL,
    `status` ENUM('STARTING', 'ACTIVE', 'PAUSED', 'FINISHED', 'ABANDONED') NOT NULL DEFAULT 'STARTING',
    `stateVersion` INTEGER NOT NULL DEFAULT 0,
    `currentPlayerId` CHAR(36) NULL,
    `round` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `winnerPlayerId` CHAR(36) NULL,
    `finishReason` VARCHAR(80) NULL,

    UNIQUE INDEX `Game_roomId_key`(`roomId`),
    INDEX `Game_status_startedAt_idx`(`status`, `startedAt`),
    INDEX `Game_boardId_boardVersion_idx`(`boardId`, `boardVersion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GamePlayer` (
    `id` CHAR(36) NOT NULL,
    `gameId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `turnOrder` INTEGER NOT NULL,
    `pawnKey` VARCHAR(80) NOT NULL,
    `colorKey` VARCHAR(40) NOT NULL,
    `finalPosition` INTEGER NULL,
    `finalBalance` INTEGER NULL,
    `finalNetWorth` INTEGER NULL,
    `status` ENUM('ACTIVE', 'DISCONNECTED', 'BANKRUPT', 'LEFT') NOT NULL DEFAULT 'ACTIVE',
    `disconnectedAt` DATETIME(3) NULL,
    `bankruptAt` DATETIME(3) NULL,

    INDEX `GamePlayer_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `GamePlayer_gameId_userId_key`(`gameId`, `userId`),
    UNIQUE INDEX `GamePlayer_gameId_turnOrder_key`(`gameId`, `turnOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameSnapshot` (
    `id` CHAR(36) NOT NULL,
    `gameId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `stateJson` JSON NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `reason` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameSnapshot_gameId_createdAt_idx`(`gameId`, `createdAt`),
    UNIQUE INDEX `GameSnapshot_gameId_version_key`(`gameId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameCommand` (
    `id` CHAR(36) NOT NULL,
    `gameId` CHAR(36) NOT NULL,
    `commandId` CHAR(36) NOT NULL,
    `actorPlayerId` CHAR(36) NOT NULL,
    `commandType` VARCHAR(80) NOT NULL,
    `expectedStateVersion` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL,
    `resultingStateVersion` INTEGER NOT NULL,
    `acknowledgementJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameCommand_gameId_resultingStateVersion_idx`(`gameId`, `resultingStateVersion`),
    UNIQUE INDEX `GameCommand_gameId_commandId_key`(`gameId`, `commandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameEvent` (
    `id` CHAR(36) NOT NULL,
    `gameId` CHAR(36) NOT NULL,
    `gameCommandId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL,
    `eventType` VARCHAR(80) NOT NULL,
    `actorPlayerId` CHAR(36) NULL,
    `payloadJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameEvent_gameId_version_idx`(`gameId`, `version`),
    INDEX `GameEvent_gameCommandId_sequence_idx`(`gameCommandId`, `sequence`),
    UNIQUE INDEX `GameEvent_gameId_sequence_key`(`gameId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameResult` (
    `id` CHAR(36) NOT NULL,
    `gameId` CHAR(36) NOT NULL,
    `winnerPlayerId` CHAR(36) NULL,
    `durationSeconds` INTEGER NOT NULL,
    `rounds` INTEGER NOT NULL,
    `summaryJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GameResult_gameId_key`(`gameId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerStatistic` (
    `userId` CHAR(36) NOT NULL,
    `gamesPlayed` INTEGER NOT NULL DEFAULT 0,
    `gamesWon` INTEGER NOT NULL DEFAULT 0,
    `propertiesPurchased` INTEGER NOT NULL DEFAULT 0,
    `tradesCompleted` INTEGER NOT NULL DEFAULT 0,
    `totalTurns` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` CHAR(36) NOT NULL,
    `actorUserId` CHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `targetType` VARCHAR(80) NOT NULL,
    `targetId` CHAR(36) NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AuditLog_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Theme` ADD CONSTRAINT `Theme_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Board` ADD CONSTRAINT `Board_themeId_fkey` FOREIGN KEY (`themeId`) REFERENCES `Theme`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BoardTile` ADD CONSTRAINT `BoardTile_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyGroup` ADD CONSTRAINT `PropertyGroup_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyDefinition` ADD CONSTRAINT `PropertyDefinition_tileId_fkey` FOREIGN KEY (`tileId`) REFERENCES `BoardTile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyDefinition` ADD CONSTRAINT `PropertyDefinition_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `PropertyGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardDeck` ADD CONSTRAINT `CardDeck_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardDefinition` ADD CONSTRAINT `CardDefinition_deckId_fkey` FOREIGN KEY (`deckId`) REFERENCES `CardDeck`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomMember` ADD CONSTRAINT `RoomMember_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomMember` ADD CONSTRAINT `RoomMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Game` ADD CONSTRAINT `Game_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Game` ADD CONSTRAINT `Game_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GamePlayer` ADD CONSTRAINT `GamePlayer_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GamePlayer` ADD CONSTRAINT `GamePlayer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameSnapshot` ADD CONSTRAINT `GameSnapshot_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameCommand` ADD CONSTRAINT `GameCommand_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameEvent` ADD CONSTRAINT `GameEvent_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameEvent` ADD CONSTRAINT `GameEvent_gameCommandId_fkey` FOREIGN KEY (`gameCommandId`) REFERENCES `GameCommand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameResult` ADD CONSTRAINT `GameResult_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerStatistic` ADD CONSTRAINT `PlayerStatistic_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
