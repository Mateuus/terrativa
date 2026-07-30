-- AlterTable
ALTER TABLE `Game` ADD COLUMN `mode` ENUM('CASUAL', 'RANKED') NOT NULL DEFAULT 'CASUAL';

-- AlterTable
ALTER TABLE `Room` ADD COLUMN `mode` ENUM('CASUAL', 'RANKED') NOT NULL DEFAULT 'CASUAL';

-- CreateTable
CREATE TABLE `RankedSeason` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('UPCOMING', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'UPCOMING',
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RankedSeason_slug_key`(`slug`),
    INDEX `RankedSeason_status_startsAt_endsAt_idx`(`status`, `startsAt`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerRating` (
    `id` CHAR(36) NOT NULL,
    `seasonId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `rating` INTEGER NOT NULL DEFAULT 1000,
    `gamesPlayed` INTEGER NOT NULL DEFAULT 0,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `topThreeFinishes` INTEGER NOT NULL DEFAULT 0,
    `provisionalGames` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlayerRating_seasonId_rating_idx`(`seasonId`, `rating`),
    INDEX `PlayerRating_userId_updatedAt_idx`(`userId`, `updatedAt`),
    UNIQUE INDEX `PlayerRating_seasonId_userId_key`(`seasonId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankedMatchResult` (
    `id` CHAR(36) NOT NULL,
    `gameId` CHAR(36) NOT NULL,
    `seasonId` CHAR(36) NOT NULL,
    `calculationVersion` INTEGER NOT NULL,
    `ratingsBeforeJson` JSON NOT NULL,
    `ratingsAfterJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RankedMatchResult_gameId_key`(`gameId`),
    INDEX `RankedMatchResult_seasonId_createdAt_idx`(`seasonId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlayerRating` ADD CONSTRAINT `PlayerRating_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `RankedSeason`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerRating` ADD CONSTRAINT `PlayerRating_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankedMatchResult` ADD CONSTRAINT `RankedMatchResult_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankedMatchResult` ADD CONSTRAINT `RankedMatchResult_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `RankedSeason`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
