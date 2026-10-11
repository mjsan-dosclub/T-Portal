/*
  Warnings:

  - You are about to drop the `email_codes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `outbox_emails` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "email_codes" DROP CONSTRAINT "email_codes_studentId_fkey";

-- AlterTable
ALTER TABLE "student_users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tempPasswordExpiresAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "email_codes";

-- DropTable
DROP TABLE "outbox_emails";
