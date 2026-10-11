-- CreateTable
CREATE TABLE "internship_programs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "workMode" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "durationValue" INTEGER NOT NULL,
    "durationUnit" TEXT NOT NULL,
    "startDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internship_assignments" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internship_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internship_programs_code_key" ON "internship_programs"("code");

-- CreateIndex
CREATE INDEX "internship_programs_status_idx" ON "internship_programs"("status");

-- CreateIndex
CREATE INDEX "internship_assignments_studentId_idx" ON "internship_assignments"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "internship_assignments_programId_studentId_key" ON "internship_assignments"("programId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_assignmentId_weekNo_key" ON "weekly_reports"("assignmentId", "weekNo");

-- AddForeignKey
ALTER TABLE "internship_assignments" ADD CONSTRAINT "internship_assignments_programId_fkey" FOREIGN KEY ("programId") REFERENCES "internship_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_assignments" ADD CONSTRAINT "internship_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "internship_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
