-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "author" TEXT,
ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "keywords" TEXT[],
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Content_keywords_idx" ON "Content"("keywords");

-- CreateIndex
CREATE INDEX "Content_author_idx" ON "Content"("author");
