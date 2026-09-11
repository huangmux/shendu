-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "intent" TEXT NOT NULL,
    "parseStatus" TEXT NOT NULL DEFAULT 'pending',
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "text" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',
    CONSTRAINT "chapters_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
