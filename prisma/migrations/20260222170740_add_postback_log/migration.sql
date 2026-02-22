-- CreateTable
CREATE TABLE "PostbackLog" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "dfsTaskId" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION,
    "ip" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostbackLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostbackLog_dfsTaskId_idx" ON "PostbackLog"("dfsTaskId");

-- CreateIndex
CREATE INDEX "PostbackLog_tag_createdAt_idx" ON "PostbackLog"("tag", "createdAt");
