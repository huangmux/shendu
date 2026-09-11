-- AlterTable
ALTER TABLE "chapters" ADD COLUMN "summary" TEXT;
ALTER TABLE "chapters" ADD COLUMN "keyPoints" TEXT;
ALTER TABLE "chapters" ADD COLUMN "questions" TEXT;
ALTER TABLE "chapters" ADD COLUMN "insightAt" DATETIME;

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "llmApiKey" TEXT NOT NULL DEFAULT '',
    "llmBaseUrl" TEXT NOT NULL DEFAULT 'https://api.deepseek.com/v1',
    "llmModel" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "updatedAt" DATETIME NOT NULL
);
