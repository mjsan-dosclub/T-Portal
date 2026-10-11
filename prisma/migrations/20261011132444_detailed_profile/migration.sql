-- AlterTable
ALTER TABLE "student_projects" ADD COLUMN     "endMonth" TEXT,
ADD COLUMN     "projectType" TEXT NOT NULL DEFAULT 'ACADEMIC',
ADD COLUMN     "role" TEXT,
ADD COLUMN     "startMonth" TEXT;

-- CreateTable
CREATE TABLE "student_profiles" (
    "studentId" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "hometown" TEXT,
    "languages" JSONB,
    "preferredRoleIds" TEXT[],
    "preferredLocations" TEXT[],
    "jobTypes" TEXT[],
    "workModes" TEXT[],
    "expectedCtcLpa" DOUBLE PRECISION,
    "availableFrom" DATE,
    "willingToRelocate" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "student_educations" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "board" TEXT,
    "institution" TEXT NOT NULL,
    "course" TEXT,
    "specialization" TEXT,
    "medium" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "ongoing" BOOLEAN NOT NULL DEFAULT false,
    "gradingSystem" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_internships" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "workMode" TEXT,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "stipendMonthly" INTEGER,
    "description" TEXT NOT NULL,
    "skillCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_internships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_certifications" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issueDate" DATE,
    "expiryDate" DATE,
    "noExpiry" BOOLEAN NOT NULL DEFAULT false,
    "credentialId" TEXT,
    "url" TEXT,
    "skillCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_accomplishments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "date" DATE,
    "url" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_accomplishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_tools" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "version" TEXT,
    "experienceMonths" INTEGER NOT NULL DEFAULT 0,
    "lastUsedYear" INTEGER,

    CONSTRAINT "student_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_resumes" (
    "studentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_resumes_pkey" PRIMARY KEY ("studentId")
);

-- CreateIndex
CREATE INDEX "student_educations_studentId_idx" ON "student_educations"("studentId");

-- CreateIndex
CREATE INDEX "student_internships_studentId_idx" ON "student_internships"("studentId");

-- CreateIndex
CREATE INDEX "student_certifications_studentId_idx" ON "student_certifications"("studentId");

-- CreateIndex
CREATE INDEX "student_accomplishments_studentId_idx" ON "student_accomplishments"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_tools_studentId_nameKey_key" ON "student_tools"("studentId", "nameKey");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_educations" ADD CONSTRAINT "student_educations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_internships" ADD CONSTRAINT "student_internships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_certifications" ADD CONSTRAINT "student_certifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_accomplishments" ADD CONSTRAINT "student_accomplishments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tools" ADD CONSTRAINT "student_tools_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_resumes" ADD CONSTRAINT "student_resumes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
