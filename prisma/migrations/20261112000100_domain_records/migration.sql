-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "domain_records" (
    "sessionId" VARCHAR(128) NOT NULL,
    "domain" VARCHAR(256) NOT NULL,
    "payload" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "domain_records_pkey" PRIMARY KEY ("sessionId","domain")
);
