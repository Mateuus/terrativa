-- CreateTable
CREATE TABLE `RankedRatingEntry` (
    `id` CHAR(36) NOT NULL,
    `rankedMatchResultId` CHAR(36) NOT NULL,
    `seasonId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `playerId` CHAR(36) NOT NULL,
    `ratingBefore` INTEGER NOT NULL,
    `ratingAfter` INTEGER NOT NULL,
    `ratingDelta` INTEGER NOT NULL,
    `placement` INTEGER NOT NULL,
    `netWorth` INTEGER NOT NULL,
    `bankrupt` BOOLEAN NOT NULL,
    `performanceScore` INTEGER NOT NULL,
    `periodPoints` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RankedRatingEntry_seasonId_createdAt_periodPoints_idx`(`seasonId`, `createdAt`, `periodPoints`),
    INDEX `RankedRatingEntry_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `RankedRatingEntry_rankedMatchResultId_userId_key`(`rankedMatchResultId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RankedRatingEntry` ADD CONSTRAINT `RankedRatingEntry_rankedMatchResultId_fkey` FOREIGN KEY (`rankedMatchResultId`) REFERENCES `RankedMatchResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankedRatingEntry` ADD CONSTRAINT `RankedRatingEntry_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `RankedSeason`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankedRatingEntry` ADD CONSTRAINT `RankedRatingEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
