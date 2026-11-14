-- John Twin: the factory as rows, so the screens read PostgreSQL instead of demo arrays.

CREATE TABLE "twin_nodes" (
    "id" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "detail" VARCHAR(4000) NOT NULL,
    "dept" VARCHAR(64),
    "status" VARCHAR(64),
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "twin_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "twin_nodes_dept_idx" ON "twin_nodes"("dept");
CREATE INDEX "twin_nodes_kind_idx" ON "twin_nodes"("kind");

CREATE TABLE "twin_edges" (
    "id" UUID NOT NULL,
    "from" VARCHAR(64) NOT NULL,
    "to" VARCHAR(64) NOT NULL,
    "label" VARCHAR(80),
    CONSTRAINT "twin_edges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "twin_edges_from_to_label_key" ON "twin_edges"("from", "to", "label");
CREATE INDEX "twin_edges_from_idx" ON "twin_edges"("from");

CREATE TABLE "twin_notebooks" (
    "id" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "ownerKind" VARCHAR(32) NOT NULL,
    "ownerId" VARCHAR(64) NOT NULL,
    "visibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "twin_notebooks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "twin_notebooks_ownerId_idx" ON "twin_notebooks"("ownerId");

CREATE TABLE "twin_notebook_entries" (
    "id" VARCHAR(64) NOT NULL,
    "notebookId" VARCHAR(64) NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "author" VARCHAR(200) NOT NULL,
    "text" VARCHAR(8000) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "twin_notebook_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "twin_notebook_entries_notebookId_idx" ON "twin_notebook_entries"("notebookId");

ALTER TABLE "twin_notebook_entries"
    ADD CONSTRAINT "twin_notebook_entries_notebookId_fkey"
    FOREIGN KEY ("notebookId") REFERENCES "twin_notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "twin_access_exceptions" (
    "id" VARCHAR(64) NOT NULL,
    "personId" VARCHAR(64) NOT NULL,
    "scope" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    CONSTRAINT "twin_access_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "twin_access_exceptions_personId_idx" ON "twin_access_exceptions"("personId");
