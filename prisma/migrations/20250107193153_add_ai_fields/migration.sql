-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'NOTE';

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "aiTags" TEXT[],
ADD COLUMN     "extractedText" TEXT,
ADD COLUMN     "imageLabels" TEXT[];

-- CreateIndex
CREATE INDEX "Content_title_idx" ON "Content"("title");

-- CreateIndex
CREATE INDEX "Content_type_idx" ON "Content"("type");

-- CreateIndex
CREATE INDEX "Content_aiTags_idx" ON "Content"("aiTags");
