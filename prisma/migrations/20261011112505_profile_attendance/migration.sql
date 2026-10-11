-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "portfolioUrl" TEXT;

-- CreateTable
CREATE TABLE "student_skills" (
    "studentId" TEXT NOT NULL,
    "skillCode" TEXT NOT NULL,
    "selfLevel" INTEGER NOT NULL DEFAULT 0,
    "verifiedLevel" INTEGER,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_skills_pkey" PRIMARY KEY ("studentId","skillCode")
);

-- CreateTable
CREATE TABLE "student_projects" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "skillCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_sessions" (
    "batchId" TEXT NOT NULL,
    "workshopN" INTEGER NOT NULL,
    "heldOn" DATE,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_sessions_pkey" PRIMARY KEY ("batchId","workshopN")
);

-- CreateTable
CREATE TABLE "attendance" (
    "studentId" TEXT NOT NULL,
    "workshopN" INTEGER NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("studentId","workshopN")
);

-- CreateIndex
CREATE INDEX "student_skills_skillCode_idx" ON "student_skills"("skillCode");

-- CreateIndex
CREATE INDEX "student_projects_studentId_idx" ON "student_projects"("studentId");

-- CreateIndex
CREATE INDEX "attendance_workshopN_idx" ON "attendance"("workshopN");

-- CreateIndex
CREATE INDEX "ontology_role_skills_skillCode_idx" ON "ontology_role_skills"("skillCode");

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skillCode_fkey" FOREIGN KEY ("skillCode") REFERENCES "ontology_skills"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_projects" ADD CONSTRAINT "student_projects_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_sessions" ADD CONSTRAINT "workshop_sessions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_sessions" ADD CONSTRAINT "workshop_sessions_workshopN_fkey" FOREIGN KEY ("workshopN") REFERENCES "ontology_workshops"("n") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_workshopN_fkey" FOREIGN KEY ("workshopN") REFERENCES "ontology_workshops"("n") ON DELETE RESTRICT ON UPDATE CASCADE;
