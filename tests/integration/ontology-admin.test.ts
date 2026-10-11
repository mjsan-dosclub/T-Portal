import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as skillsPOST } from "@/app/api/ontology/skills/route";
import { DELETE as skillDELETE, PUT as skillPUT } from "@/app/api/ontology/skills/[code]/route";
import { POST as retirePOST } from "@/app/api/ontology/skills/[code]/retire/route";
import { POST as restorePOST } from "@/app/api/ontology/skills/[code]/restore/route";
import { POST as subPOST } from "@/app/api/ontology/subcategories/route";
import { POST as rolesPOST, GET as rolesGET } from "@/app/api/ontology/roles/route";
import { PUT as roleSkillsPUT } from "@/app/api/ontology/roles/[id]/skills/route";
import { POST as roleRetirePOST } from "@/app/api/ontology/roles/[id]/retire/route";
import { POST as studentsPOST } from "@/app/api/students/route";
import { categoriesWithTree, getRole, listRoles, roleOptions } from "@/server/ontology/queries";
import { seedOntology } from "@/server/ontology/seed";
import { call, resetData, resetOntology, seedMasters, signedIn, studentInput } from "../helpers";

const newSkill = (over: Record<string, unknown> = {}) => ({ code: "SLMF", name: "Small language model fine-tuning", description: "Fine-tuning compact language models for on-device and low-cost Indian-language use cases.", subcategoryId: 0, ...over });

describe("Ontology maintenance (ONT-EDIT)", () => {
  let sub34: number;
  beforeEach(async () => {
    await resetData();
    await resetOntology();
    sub34 = (await db.ontSubcategory.findUniqueOrThrow({ where: { code: "3.4" } })).id;
  });
  afterAll(resetOntology);

  it("ONT-10 adding a skill (and a new subcategory) works, shows in the tree, and is audited", async () => {
    const { cookie } = await signedIn("ADMIN");
    const sc = await call(subPOST, { body: { categoryId: 3, name: "LLM Product Engineering" }, cookie });
    expect(sc.status).toBe(201);
    expect(sc.json.code).toBe("3.7");
    const r = await call(skillsPOST, { body: newSkill({ subcategoryId: sc.json.id, code: "slmf" }), cookie });
    expect(r.status).toBe(201);
    expect(r.json.code).toBe("SLMF");
    const tree = await categoriesWithTree();
    const sub = tree.find((c) => c.id === 3)!.subcategories.find((s) => s.code === "3.7")!;
    expect(sub.skills.map((s) => s.code)).toEqual(["SLMF"]);
    expect(await db.auditLog.count({ where: { action: "ontology.skill_create", entityId: "SLMF" } })).toBe(1);
    expect((await db.ontSkill.findUniqueOrThrow({ where: { code: "SLMF" } })).source).toBe("DOS Club");
  });

  it("ONT-11 duplicate or malformed skill codes are rejected", async () => {
    const { cookie } = await signedIn("ADMIN");
    expect((await call(skillsPOST, { body: newSkill({ code: "ARCH", subcategoryId: sub34 }), cookie })).status).toBe(409);
    expect((await call(skillsPOST, { body: newSkill({ code: "ab", subcategoryId: sub34 }), cookie })).status).toBe(400);
    expect((await call(skillsPOST, { body: newSkill({ code: "TOO-LONG1", subcategoryId: sub34 }), cookie })).status).toBe(400);
    expect((await call(skillsPOST, { body: newSkill({ code: "1ABC", subcategoryId: sub34 }), cookie })).status).toBe(400);
    expect((await call(skillsPOST, { body: newSkill({ name: "Solution architecture", subcategoryId: sub34 }), cookie })).status).toBe(409); // same name as ARCH
    const v = await signedIn("VIEWER");
    expect((await call(skillsPOST, { body: newSkill({ subcategoryId: sub34 }), cookie: v.cookie })).status).toBe(403);
  });

  it("ONT-12 retiring a skill used by active roles is blocked, then retires+unlinks with consent, hides it, and can be restored", async () => {
    const { cookie } = await signedIn("ADMIN");
    const users = await db.ontRole.findMany({ where: { skills: { some: { skillCode: "EMRG" } } } });
    expect(users.length).toBeGreaterThan(0);
    const blocked = await call(retirePOST, { body: { reason: "Superseded" }, cookie, params: { code: "EMRG" } });
    expect(blocked.status).toBe(409);
    expect((blocked.json.roles as { name: string }[]).map((r) => r.name)).toContain("Enterprise Architect");
    const ok = await call(retirePOST, { body: { reason: "Superseded", removeFromRoles: true }, cookie, params: { code: "EMRG" } });
    expect(ok.status).toBe(200);
    expect(ok.json.removedFromRoles).toBe(users.length);
    const ea = await getRole((await listRoles({ q: "Enterprise Architect" }))[0]!.id);
    expect(ea!.skills.map((s) => s.skill.code)).not.toContain("EMRG");
    const tree = await categoriesWithTree();
    expect(tree.flatMap((c) => c.subcategories.flatMap((s) => s.skills.map((k) => k.code)))).not.toContain("EMRG");
    // can't be added back to a role while retired
    const roleId = ea!.id;
    const add = await call(roleSkillsPUT, { method: "PUT", body: { skills: [{ code: "EMRG", level: 4 }, { code: "ARCH", level: 4 }] }, cookie, params: { id: roleId } });
    expect(add.status).toBe(400);
    expect((await call(restorePOST, { body: {}, cookie, params: { code: "EMRG" } })).status).toBe(200);
    expect((await db.ontSkill.findUniqueOrThrow({ where: { code: "EMRG" } })).isActive).toBe(true);
    expect(await db.auditLog.count({ where: { action: { in: ["ontology.skill_retire", "ontology.skill_restore"] }, entityId: "EMRG" } })).toBe(2);
  });

  it("ONT-13 re-running the seed keeps admin edits, additions and retirements", async () => {
    const { cookie } = await signedIn("ADMIN");
    await call(skillsPOST, { body: newSkill({ subcategoryId: sub34 }), cookie });
    await call(skillPUT, { method: "PUT", body: { name: "Solution architecture (cloud-first)", description: "Designing cloud-first solution architectures end to end.", subcategoryId: (await db.ontSkill.findUniqueOrThrow({ where: { code: "ARCH" } })).subcategoryId }, cookie, params: { code: "ARCH" } });
    await db.ontSkill.update({ where: { code: "IRMG" }, data: { isActive: false } });
    const counts = await seedOntology(db);
    expect(counts.skills).toBe(166);
    expect((await db.ontSkill.findUniqueOrThrow({ where: { code: "ARCH" } })).name).toBe("Solution architecture (cloud-first)");
    expect((await db.ontSkill.findUniqueOrThrow({ where: { code: "IRMG" } })).isActive).toBe(false);
    expect(await db.ontSkill.count({ where: { code: "SLMF" } })).toBe(1);
  });

  it("ONT-14 a role's required skills can be replaced; bad codes and levels are rejected", async () => {
    const { cookie } = await signedIn("ADMIN");
    const role = (await listRoles({ q: "Agentic AI Engineer" }))[0]!;
    await call(skillsPOST, { body: newSkill({ subcategoryId: sub34 }), cookie });
    const r = await call(roleSkillsPUT, { method: "PUT", body: { skills: [{ code: "SLMF", level: 3 }, { code: "agen", level: 4 }] }, cookie, params: { id: role.id } });
    expect(r.status).toBe(200);
    const after = await getRole(role.id);
    expect(after!.skills.map((s) => `${s.skill.code}@L${s.level}`).sort()).toEqual(["AGEN@L4", "SLMF@L3"]);
    expect((await call(roleSkillsPUT, { method: "PUT", body: { skills: [{ code: "NOPE", level: 3 }] }, cookie, params: { id: role.id } })).status).toBe(400);
    expect((await call(roleSkillsPUT, { method: "PUT", body: { skills: [{ code: "SLMF", level: 7 }] }, cookie, params: { id: role.id } })).status).toBe(400);
    expect((await call(roleSkillsPUT, { method: "PUT", body: { skills: [] }, cookie, params: { id: role.id } })).status).toBe(400);
  });

  it("ONT-15 delete only works for portal-added skills that no role uses", async () => {
    const { cookie } = await signedIn("ADMIN");
    await call(skillsPOST, { body: newSkill({ subcategoryId: sub34 }), cookie });
    const framework = await call(skillDELETE, { method: "DELETE", cookie, params: { code: "IRMG" } });
    expect(framework.status, JSON.stringify(framework.json)).toBe(409);
    const role = (await listRoles({ q: "Agentic AI Engineer" }))[0]!;
    await call(roleSkillsPUT, { method: "PUT", body: { skills: [{ code: "SLMF", level: 2 }] }, cookie, params: { id: role.id } });
    expect((await call(skillDELETE, { method: "DELETE", cookie, params: { code: "SLMF" } })).status).toBe(409);
    await call(roleSkillsPUT, { method: "PUT", body: { skills: [{ code: "AGEN", level: 3 }] }, cookie, params: { id: role.id } });
    // still linked historically? no: replaced, so the link is gone → deletable
    expect((await call(skillDELETE, { method: "DELETE", cookie, params: { code: "SLMF" } })).status).toBe(200);
    expect(await db.ontSkill.count({ where: { code: "SLMF" } })).toBe(0);
  });

  it("ONT-16 a retired role leaves the explorer and the target-role picker; linked students keep it", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("ADMIN");
    const role = (await listRoles({ q: "Agentic AI Engineer" }))[0]!;
    const s = await call(studentsPOST, { body: studentInput(m, 1, { targetRoleId: role.id }), cookie });
    expect(s.status).toBe(201);
    const r = await call(roleRetirePOST, { body: { reason: "Merged into AI Engineer" }, cookie, params: { id: role.id } });
    expect(r.json.linkedStudents).toBe(1);
    expect((await listRoles({ q: "agentic" })).length).toBe(0);
    const list = await call(rolesGET, { cookie, url: "http://localhost:3000/api/ontology/roles?q=agentic" });
    expect((list.json.roles as unknown[]).length).toBe(0);
    expect((await roleOptions()).map((x) => x.id)).not.toContain(role.id);
    expect((await roleOptions(role.id)).map((x) => x.id)).toContain(role.id); // still shown for the student who has it
    expect((await db.student.findUniqueOrThrow({ where: { id: s.json.id as string } })).targetRoleId).toBe(role.id);
    const s2 = await call(studentsPOST, { body: studentInput(m, 2, { targetRoleId: role.id }), cookie });
    expect(s2.status).toBe(400); // can't pick a retired role for a new student
    const created = await call(rolesPOST, { body: { name: "Agentic Systems Engineer", categoryId: 3, track: "IC", levelMin: 2, levelMax: 4 }, cookie });
    expect(created.status).toBe(201);
    const bad = await call(rolesPOST, { body: { name: "X Role", categoryId: 3, track: "Lead", levelMin: 4, levelMax: 2 }, cookie });
    expect(bad.status).toBe(400);
  });
});
