-- CreateTable
CREATE TABLE "ContentContext" (
    "id" SERIAL NOT NULL,
    "sourceUrl" TEXT,
    "selectedText" TEXT,
    "pageContext" TEXT,
    "captureTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userThought" TEXT,
    "contentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentContext_contentId_idx" ON "ContentContext"("contentId");

-- AddForeignKey
ALTER TABLE "ContentContext" ADD CONSTRAINT "ContentContext_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
