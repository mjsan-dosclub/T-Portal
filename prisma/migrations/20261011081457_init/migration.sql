-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('UG', 'PG', 'DIPLOMA');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PREVIEW', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "UploadRowStatus" AS ENUM ('VALID', 'DUPLICATE_FILE', 'DUPLICATE_DB', 'ERROR');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecretEnc" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpLastStep" INTEGER,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "tablePrefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "mfaPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "shortCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isPartner" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degrees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "level" "DegreeLevel" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "degrees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "shortCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_aliases" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasKey" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "department_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "codeKey" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colour_teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "hexColor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colour_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "color" TEXT,
    "isActiveState" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gender" "Gender",
    "dateOfBirth" DATE,
    "institutionId" TEXT NOT NULL,
    "degreeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "yearOfStudy" INTEGER,
    "graduationYear" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "colourTeamId" TEXT,
    "statusId" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "notes" TEXT,
    "targetRoleId" TEXT,
    "userId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_counters" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "code_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "upload_jobs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PREVIEW',
    "total" INTEGER NOT NULL DEFAULT 0,
    "valid" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "mapping" JSONB,
    "failure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_rows" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "normalized" JSONB,
    "status" "UploadRowStatus" NOT NULL,
    "errors" JSONB,
    "duplicateStudentId" TEXT,
    "decision" TEXT,

    CONSTRAINT "upload_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ontology_categories" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ontology_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ontology_subcategories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "ontology_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ontology_skills" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "subcategoryId" INTEGER NOT NULL,

    CONSTRAINT "ontology_skills_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ontology_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "levelMin" INTEGER NOT NULL,
    "levelMax" INTEGER NOT NULL,

    CONSTRAINT "ontology_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ontology_role_skills" (
    "roleId" TEXT NOT NULL,
    "skillCode" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "ontology_role_skills_pkey" PRIMARY KEY ("roleId","skillCode")
);

-- CreateTable
CREATE TABLE "ontology_roadmap_steps" (
    "id" SERIAL NOT NULL,
    "roleId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "levelNum" INTEGER NOT NULL,
    "levelLabel" TEXT NOT NULL,
    "whatYouDo" TEXT NOT NULL,
    "tools" TEXT NOT NULL,
    "next" TEXT NOT NULL,

    CONSTRAINT "ontology_roadmap_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ontology_levels" (
    "n" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "ontology_levels_pkey" PRIMARY KEY ("n")
);

-- CreateTable
CREATE TABLE "ontology_workshops" (
    "n" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "roleText" TEXT NOT NULL,

    CONSTRAINT "ontology_workshops_pkey" PRIMARY KEY ("n")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "recovery_codes_adminId_idx" ON "recovery_codes"("adminId");

-- CreateIndex
CREATE INDEX "sessions_adminId_idx" ON "sessions"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_nameKey_key" ON "institutions"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "degrees_nameKey_key" ON "degrees"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "departments_nameKey_key" ON "departments"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "department_aliases_aliasKey_key" ON "department_aliases"("aliasKey");

-- CreateIndex
CREATE INDEX "department_aliases_departmentId_idx" ON "department_aliases"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "batches_codeKey_key" ON "batches"("codeKey");

-- CreateIndex
CREATE UNIQUE INDEX "colour_teams_nameKey_key" ON "colour_teams"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "student_statuses_nameKey_key" ON "student_statuses"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "students_studentCode_key" ON "students"("studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_phone_key" ON "students"("phone");

-- CreateIndex
CREATE INDEX "students_deletedAt_idx" ON "students"("deletedAt");

-- CreateIndex
CREATE INDEX "students_fullName_idx" ON "students"("fullName");

-- CreateIndex
CREATE INDEX "students_institutionId_idx" ON "students"("institutionId");

-- CreateIndex
CREATE INDEX "students_departmentId_idx" ON "students"("departmentId");

-- CreateIndex
CREATE INDEX "students_degreeId_idx" ON "students"("degreeId");

-- CreateIndex
CREATE INDEX "students_batchId_idx" ON "students"("batchId");

-- CreateIndex
CREATE INDEX "students_statusId_idx" ON "students"("statusId");

-- CreateIndex
CREATE INDEX "students_colourTeamId_idx" ON "students"("colourTeamId");

-- CreateIndex
CREATE INDEX "students_graduationYear_idx" ON "students"("graduationYear");

-- CreateIndex
CREATE INDEX "students_createdAt_idx" ON "students"("createdAt");

-- CreateIndex
CREATE INDEX "upload_jobs_uploadedById_createdAt_idx" ON "upload_jobs"("uploadedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "upload_rows_jobId_rowNo_key" ON "upload_rows"("jobId", "rowNo");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ontology_categories_name_key" ON "ontology_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ontology_subcategories_code_key" ON "ontology_subcategories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ontology_roles_name_key" ON "ontology_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ontology_roadmap_steps_roleId_sort_key" ON "ontology_roadmap_steps"("roleId", "sort");

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_aliases" ADD CONSTRAINT "department_aliases_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_degreeId_fkey" FOREIGN KEY ("degreeId") REFERENCES "degrees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_colourTeamId_fkey" FOREIGN KEY ("colourTeamId") REFERENCES "colour_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "student_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "ontology_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_rows" ADD CONSTRAINT "upload_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "upload_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ontology_subcategories" ADD CONSTRAINT "ontology_subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ontology_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ontology_skills" ADD CONSTRAINT "ontology_skills_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "ontology_subcategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ontology_roles" ADD CONSTRAINT "ontology_roles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ontology_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ontology_role_skills" ADD CONSTRAINT "ontology_role_skills_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ontology_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ontology_role_skills" ADD CONSTRAINT "ontology_role_skills_skillCode_fkey" FOREIGN KEY ("skillCode") REFERENCES "ontology_skills"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ontology_roadmap_steps" ADD CONSTRAINT "ontology_roadmap_steps_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ontology_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
