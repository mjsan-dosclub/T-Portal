// DEV ONLY: fake data for local development (CLAUDE.md §1). Every person uses @example.test and +9190000xxxxx.
// Usage: npm run db:seed:dev [count]
import { nameKey } from "../src/lib/normalize";
import { scriptClient } from "./client-for-scripts";
import { seedBase } from "./seed";

const INSTITUTIONS = ["Example Institute of Technology", "Sample College of Engineering", "Demo University", "Test Arts & Science College"];
const DEPARTMENTS: [string, string, string[]][] = [
  ["Computer Science and Engineering", "CSE", ["Computer Science", "Comp Sci", "CS", "C.S.E"]],
  ["Information Technology", "IT", ["Info Tech"]],
  ["Electronics and Communication Engineering", "ECE", ["Electronics"]],
  ["Artificial Intelligence and Data Science", "AIDS", ["AI&DS", "AI & DS"]],
  ["Mechanical Engineering", "MECH", ["Mechanical"]],
];
const FIRST = ["Arun", "Priya", "Karthik", "Divya", "Vignesh", "Meena", "Rahul", "Sneha", "அருண்", "கவியா", "Lakshmi", "Suresh", "Anjali", "Mohammed", "Fathima", "Joseph"];
const LAST = ["Kumar", "Raj", "Sharma", "Iyer", "Nair", "குமார்", "Reddy", "Das", "Khan", "Thomas", "Pillai", "Menon"];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error("seed.dev refuses to run against a non-local DATABASE_URL");
  const count = Number(process.argv[2] ?? 300);
  const db = scriptClient();
  await seedBase(db);
  for (const name of INSTITUTIONS) await db.institution.upsert({ where: { nameKey: nameKey(name) }, create: { name, nameKey: nameKey(name), isPartner: true, city: "Chennai", state: "Tamil Nadu" }, update: {} });
  for (const [name, code, aliases] of DEPARTMENTS) {
    const d = await db.department.upsert({ where: { nameKey: nameKey(name) }, create: { name, nameKey: nameKey(name), shortCode: code }, update: {} });
    for (const a of [code, ...aliases]) await db.departmentAlias.upsert({ where: { aliasKey: nameKey(a) }, create: { alias: a, aliasKey: nameKey(a), departmentId: d.id }, update: {} });
  }
  for (const [code, year] of [["2025-B1", 2025], ["2025-B2", 2025], ["2026-B1", 2026]] as const) {
    await db.batch.upsert({ where: { codeKey: nameKey(code) }, create: { batchCode: code, codeKey: nameKey(code), year }, update: {} });
  }
  for (const t of ["Red", "Green", "Blue"]) await db.colourTeam.upsert({ where: { nameKey: nameKey(t) }, create: { name: t, nameKey: nameKey(t) }, update: {} });

  const [insts, degs, depts, batches, teams, statuses] = await Promise.all([
    db.institution.findMany(), db.degree.findMany(), db.department.findMany(), db.batch.findMany(), db.colourTeam.findMany(), db.studentStatus.findMany(),
  ]);
  const existing = await db.student.count();
  let made = 0;
  for (let i = existing; i < existing + count; i++) {
    const batch = batches[i % batches.length]!;
    const c = await db.codeCounter.upsert({ where: { year: batch.year }, create: { year: batch.year, last: 1 }, update: { last: { increment: 1 } } });
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 7) % LAST.length]!;
    await db.student.create({
      data: {
        studentCode: `DOS-${batch.year}-${String(c.last).padStart(5, "0")}`,
        fullName: `${first} ${last}`,
        email: `student${i + 1}@example.test`,
        phone: `+9190000${String(10000 + i).slice(-5)}`,
        gender: (["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const)[i % 4],
        institutionId: insts[i % insts.length]!.id,
        degreeId: degs[i % degs.length]!.id,
        departmentId: depts[(i * 3) % depts.length]!.id,
        yearOfStudy: (i % 4) + 1,
        graduationYear: 2026 + (i % 4),
        batchId: batch.id,
        colourTeamId: i % 5 === 0 ? null : teams[i % teams.length]!.id,
        statusId: statuses[i % 7 === 0 ? (i % statuses.length) : statuses.findIndex((s) => s.isDefault)]!.id,
        city: "Chennai",
        state: "Tamil Nadu",
      },
    });
    made++;
  }
  // Phase 2 demo data (fake): target roles, self-ratings, some verified levels, attendance for the first days.
  const roles = await db.ontRole.findMany({ where: { isActive: true }, take: 12, orderBy: { name: "asc" }, include: { skills: true } });
  // Only fake @example.test records get demo data; never touch anything someone typed in by hand.
  const all = await db.student.findMany({ where: { deletedAt: null, email: { endsWith: "@example.test" } }, select: { id: true, batchId: true }, orderBy: { studentCode: "asc" } });
  let rated = 0;
  for (const [i, st] of all.entries()) {
    if (i % 3 === 2) continue; // a third have no plan yet
    const role = roles[i % roles.length]!;
    await db.student.update({ where: { id: st.id }, data: { targetRoleId: role.id } });
    for (const [j, rs] of role.skills.entries()) {
      const self = Math.max(0, Math.min(6, rs.level - ((i + j) % 3))); // some met, some 1–2 levels short
      const verified = i % 5 === 0 ? Math.max(0, self - (j % 2)) : null;
      await db.studentSkill.upsert({ where: { studentId_skillCode: { studentId: st.id, skillCode: rs.skillCode } }, create: { studentId: st.id, skillCode: rs.skillCode, selfLevel: self, verifiedLevel: verified, verifiedAt: verified === null ? null : new Date() }, update: {} });
    }
    rated++;
  }
  for (const b of batches) {
    const daysHeld = b.year === 2025 ? 8 : 3;
    const members = all.filter((s) => s.batchId === b.id);
    for (let n = 1; n <= daysHeld; n++) {
      await db.workshopSession.upsert({ where: { batchId_workshopN: { batchId: b.id, workshopN: n } }, create: { batchId: b.id, workshopN: n, heldOn: new Date(Date.UTC(b.year, 6, n)) }, update: {} });
      for (const [k, m] of members.entries()) {
        const status = (k + n) % 9 === 0 ? "EXCUSED" : (k * n) % 5 === 0 ? "ABSENT" : "PRESENT";
        await db.attendance.upsert({ where: { studentId_workshopN: { studentId: m.id, workshopN: n } }, create: { studentId: m.id, workshopN: n, status }, update: {} });
      }
    }
  }
  console.log(`Dev seed done: ${made} fake students added (total ${existing + made}); ${rated} with target roles and ratings; attendance for early workshop days.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
