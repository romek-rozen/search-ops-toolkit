-- CreateTable
CREATE TABLE "DfsLocation" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,

    CONSTRAINT "DfsLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DfsLanguage" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DfsLanguage_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "DfsSerpLocation" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,

    CONSTRAINT "DfsSerpLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "category" TEXT,
    "rating" DOUBLE PRECISION,
    "totalReviews" INTEGER,
    "mapsUrl" TEXT,
    "dfsLogin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "dfsTaskId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "depth" INTEGER NOT NULL DEFAULT 100,
    "cost" DOUBLE PRECISION,
    "timeSec" TEXT,
    "locationName" TEXT,
    "languageName" TEXT,
    "keyword" TEXT,
    "device" TEXT,
    "os" TEXT,
    "dfsStatusCode" INTEGER,
    "dfsResponse" JSONB,
    "error" TEXT,
    "dfsLogin" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessInfoTask" (
    "id" TEXT NOT NULL,
    "dfsTaskId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cost" DOUBLE PRECISION,
    "timeSec" TEXT,
    "locationName" TEXT,
    "languageCode" TEXT,
    "dfsStatusCode" INTEGER,
    "dfsResponse" JSONB,
    "error" TEXT,
    "dfsLogin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessInfoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessNameHistory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessNameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDataHistory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "category" TEXT,
    "rating" DOUBLE PRECISION,
    "totalReviews" INTEGER,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessDataHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapsSearchTask" (
    "id" TEXT NOT NULL,
    "dfsTaskId" TEXT,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "locationName" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 100,
    "method" TEXT NOT NULL DEFAULT 'live',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cost" DOUBLE PRECISION,
    "timeSec" DOUBLE PRECISION,
    "resultsCount" INTEGER,
    "dfsResponse" JSONB,
    "dfsLogin" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapsSearchTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapsSearchResult" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "rankAbsolute" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "domain" TEXT,
    "url" TEXT,
    "cid" TEXT,
    "placeId" TEXT,
    "rating" DOUBLE PRECISION,
    "votesCount" INTEGER,
    "ratingDistribution" JSONB,
    "category" TEXT,
    "additionalCategories" TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "snippet" TEXT,
    "mainImage" TEXT,
    "workHours" JSONB,
    "priceLevel" TEXT,
    "isClaimed" BOOLEAN,
    "featureId" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessCid" TEXT,

    CONSTRAINT "MapsSearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "publishedAt" TIMESTAMP(3),
    "ownerResponse" TEXT,
    "ownerRespondedAt" TIMESTAMP(3),
    "dfsLogin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ReviewTaskReviews" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReviewTaskReviews_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "DfsSerpLocation_countryCode_idx" ON "DfsSerpLocation"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Business_cid_key" ON "Business"("cid");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTask_dfsTaskId_key" ON "ReviewTask"("dfsTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessInfoTask_dfsTaskId_key" ON "BusinessInfoTask"("dfsTaskId");

-- CreateIndex
CREATE INDEX "BusinessDataHistory_businessId_recordedAt_idx" ON "BusinessDataHistory"("businessId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MapsSearchTask_dfsTaskId_key" ON "MapsSearchTask"("dfsTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_businessId_authorName_publishedAt_key" ON "Review"("businessId", "authorName", "publishedAt");

-- CreateIndex
CREATE INDEX "_ReviewTaskReviews_B_index" ON "_ReviewTaskReviews"("B");

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessInfoTask" ADD CONSTRAINT "BusinessInfoTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessNameHistory" ADD CONSTRAINT "BusinessNameHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDataHistory" ADD CONSTRAINT "BusinessDataHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapsSearchResult" ADD CONSTRAINT "MapsSearchResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MapsSearchTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapsSearchResult" ADD CONSTRAINT "MapsSearchResult_businessCid_fkey" FOREIGN KEY ("businessCid") REFERENCES "Business"("cid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewTaskReviews" ADD CONSTRAINT "_ReviewTaskReviews_A_fkey" FOREIGN KEY ("A") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewTaskReviews" ADD CONSTRAINT "_ReviewTaskReviews_B_fkey" FOREIGN KEY ("B") REFERENCES "ReviewTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
