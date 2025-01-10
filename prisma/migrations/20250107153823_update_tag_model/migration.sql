/*
  Warnings:

  - You are about to drop the column `name` on the `Tag` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[title]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `title` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Tag_name_key";

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "name",
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_title_key" ON "Tag"("title");
