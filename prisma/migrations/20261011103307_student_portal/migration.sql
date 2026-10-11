-- CreateTable
CREATE TABLE "student_users" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecretEnc" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpLastStep" INTEGER,
    "lastLoginAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_recovery_codes" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "student_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_sessions" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "mfaPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "student_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_codes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedTokenHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_emails" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "transport" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_users_studentId_key" ON "student_users"("studentId");

-- CreateIndex
CREATE INDEX "student_recovery_codes_studentUserId_idx" ON "student_recovery_codes"("studentUserId");

-- CreateIndex
CREATE INDEX "student_sessions_studentUserId_idx" ON "student_sessions"("studentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "email_codes_verifiedTokenHash_key" ON "email_codes"("verifiedTokenHash");

-- CreateIndex
CREATE INDEX "email_codes_studentId_purpose_createdAt_idx" ON "email_codes"("studentId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_emails_createdAt_idx" ON "outbox_emails"("createdAt");

-- AddForeignKey
ALTER TABLE "student_users" ADD CONSTRAINT "student_users_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_recovery_codes" ADD CONSTRAINT "student_recovery_codes_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "student_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "student_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_codes" ADD CONSTRAINT "email_codes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
