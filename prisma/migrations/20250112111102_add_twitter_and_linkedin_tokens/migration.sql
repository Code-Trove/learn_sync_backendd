/*
  Warnings:

  - You are about to drop the column `accessToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tokenSecret` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LearningPath" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Summary" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "accessToken",
DROP COLUMN "token",
DROP COLUMN "tokenSecret",
ADD COLUMN     "linkedinToken" TEXT,
ADD COLUMN     "twitterSecret" TEXT,
ADD COLUMN     "twitterToken" TEXT;
