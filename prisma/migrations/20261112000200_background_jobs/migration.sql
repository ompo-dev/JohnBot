-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ENQUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(128) NOT NULL,
    "domain" VARCHAR(256) NOT NULL,
    "revision" INTEGER NOT NULL,
    "type" VARCHAR(64) NOT NULL DEFAULT 'cache.refresh',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "dispatchToken" UUID,
    "dispatchUntil" TIMESTAMPTZ(3),
    "runToken" UUID,
    "lastError" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "background_jobs_status_dispatchUntil_createdAt_idx" ON "background_jobs"("status", "dispatchUntil", "createdAt");

-- CreateIndex
CREATE INDEX "background_jobs_sessionId_createdAt_idx" ON "background_jobs"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "background_jobs_sessionId_domain_revision_type_key" ON "background_jobs"("sessionId", "domain", "revision", "type");

-- AddForeignKey
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_sessionId_domain_fkey" FOREIGN KEY ("sessionId", "domain") REFERENCES "domain_records"("sessionId", "domain") ON DELETE CASCADE ON UPDATE CASCADE;
