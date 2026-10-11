import "server-only";
import { db } from "@/lib/db";
import { nameKey } from "@/lib/normalize";
import { masterSchemas, type MasterInput, type MasterType } from "@/lib/validation/masters";
import { audit } from "./audit";
import { HttpError } from "./http";
import type { SessionAdmin } from "./auth/session";

type Meta = { ip?: string; userAgent?: string | null };

export type MasterRow = {
  id: string;
  label: string;
  isActive: boolean;
  usage: number;
  fields: Record<string, unknown>;
};

function fmtDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** All rows of a master with usage counts (in-use rows can't be deleted, MST-02). */
export async function listMaster(type: MasterType, opts: { activeOnly?: boolean } = {}): Promise<MasterRow[]> {
  const where = opts.activeOnly ? { isActive: true } : {};
  const usage = { _count: { select: { students: { where: { deletedAt: null } } } } } as const;
  switch (type) {
    case "institutions":
      return (await db.institution.findMany({ where, orderBy: { name: "asc" }, include: usage })).map((r) => ({
        id: r.id, label: r.name, isActive: r.isActive, usage: r._count.students,
        fields: { name: r.name, shortCode: r.shortCode, city: r.city, state: r.state, isPartner: r.isPartner },
      }));
    case "degrees":
      return (await db.degree.findMany({ where, orderBy: { name: "asc" }, include: usage })).map((r) => ({
        id: r.id, label: r.name, isActive: r.isActive, usage: r._count.students, fields: { name: r.name, level: r.level },
      }));
    case "departments":
      return (await db.department.findMany({ where, orderBy: { name: "asc" }, include: { ...usage, aliases: { orderBy: { alias: "asc" } } } })).map((r) => ({
        id: r.id, label: r.name, isActive: r.isActive, usage: r._count.students,
        fields: { name: r.name, shortCode: r.shortCode, aliases: r.aliases.map((a) => a.alias) },
      }));
    case "batches":
      return (await db.batch.findMany({ where, orderBy: [{ year: "desc" }, { batchCode: "asc" }], include: usage })).map((r) => ({
        id: r.id, label: r.batchCode, isActive: r.isActive, usage: r._count.students,
        fields: { batchCode: r.batchCode, year: r.year, startDate: fmtDate(r.startDate), endDate: fmtDate(r.endDate) },
      }));
    case "colour-teams":
      return (await db.colourTeam.findMany({ where, orderBy: { name: "asc" }, include: usage })).map((r) => ({
        id: r.id, label: r.name, isActive: r.isActive, usage: r._count.students, fields: { name: r.name, hexColor: r.hexColor },
      }));
    case "statuses":
      return (await db.studentStatus.findMany({ where, orderBy: { name: "asc" }, include: usage })).map((r) => ({
        id: r.id, label: r.name, isActive: r.isActive, usage: r._count.students,
        fields: { name: r.name, color: r.color, isActiveState: r.isActiveState, isDefault: r.isDefault },
      }));
  }
}

/** Active options for dropdowns (MST-03), plus any extra ids so existing records still show their (inactive) value. */
export async function masterOptions(includeIds: string[] = []) {
  const w = { OR: [{ isActive: true }, { id: { in: includeIds } }] };
  const [institutions, degrees, departments, batches, teams, statuses] = await Promise.all([
    db.institution.findMany({ where: w, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
    db.degree.findMany({ where: w, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
    db.department.findMany({ where: w, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
    db.batch.findMany({ where: w, orderBy: [{ year: "desc" }, { batchCode: "asc" }], select: { id: true, batchCode: true, isActive: true } }),
    db.colourTeam.findMany({ where: w, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
    db.studentStatus.findMany({ where: w, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true, isDefault: true, color: true } }),
  ]);
  return {
    institutions: institutions.map((r) => ({ id: r.id, label: r.name, isActive: r.isActive })),
    degrees: degrees.map((r) => ({ id: r.id, label: r.name, isActive: r.isActive })),
    departments: departments.map((r) => ({ id: r.id, label: r.name, isActive: r.isActive })),
    batches: batches.map((r) => ({ id: r.id, label: r.batchCode, isActive: r.isActive })),
    colourTeams: teams.map((r) => ({ id: r.id, label: r.name, isActive: r.isActive })),
    statuses: statuses.map((r) => ({ id: r.id, label: r.name, isActive: r.isActive, isDefault: r.isDefault, color: r.color })),
  };
}
export type MasterOptions = Awaited<ReturnType<typeof masterOptions>>;

function duplicate(label: string): never {
  throw new HttpError(409, `${label} already exists (names are case-insensitive)`, { fields: { name: "Already exists" } });
}

async function assertUnique(type: MasterType, key: string, exceptId?: string) {
  const not = exceptId ? { id: { not: exceptId } } : {};
  const hit =
    type === "institutions" ? await db.institution.findFirst({ where: { nameKey: key, ...not } })
    : type === "degrees" ? await db.degree.findFirst({ where: { nameKey: key, ...not } })
    : type === "departments" ? await db.department.findFirst({ where: { nameKey: key, ...not } })
    : type === "batches" ? await db.batch.findFirst({ where: { codeKey: key, ...not } })
    : type === "colour-teams" ? await db.colourTeam.findFirst({ where: { nameKey: key, ...not } })
    : await db.studentStatus.findFirst({ where: { nameKey: key, ...not } });
  if (hit) duplicate(type === "batches" ? "Batch code" : "A value with this name");
}

async function assertAliasesFree(aliases: string[], departmentId: string | undefined, nameK: string) {
  const keys = [...new Set(aliases.map(nameKey))];
  if (keys.length !== aliases.length) throw new HttpError(400, "Duplicate aliases in the list", { fields: { aliases: "Each alias must be unique" } });
  if (keys.includes(nameK)) throw new HttpError(400, "An alias can't be the same as the name", { fields: { aliases: "Alias equals the name" } });
  const taken = await db.departmentAlias.findMany({ where: { aliasKey: { in: keys }, ...(departmentId ? { departmentId: { not: departmentId } } : {}) }, include: { department: { select: { name: true } } } });
  if (taken.length) {
    throw new HttpError(409, `Alias "${taken[0]!.alias}" already belongs to ${taken[0]!.department.name}`, { fields: { aliases: "Alias already used by another department" } });
  }
  const asName = await db.department.findFirst({ where: { nameKey: { in: keys }, ...(departmentId ? { id: { not: departmentId } } : {}) } });
  if (asName) throw new HttpError(409, `"${asName.name}" is already a department name`, { fields: { aliases: "Alias matches another department's name" } });
}

function keyFor<T extends MasterType>(type: T, data: MasterInput<T>): string {
  return type === "batches" ? nameKey((data as MasterInput<"batches">).batchCode) : nameKey((data as { name: string }).name);
}

export async function createMaster<T extends MasterType>(type: T, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const data = masterSchemas[type].parse(raw) as MasterInput<T>;
  const key = keyFor(type, data);
  await assertUnique(type, key);
  if (type === "departments") await assertAliasesFree((data as MasterInput<"departments">).aliases, undefined, key);
  return db.$transaction(async (tx) => {
    const id = await insert(tx, type, data, key);
    await audit(tx, { actorId: actor.id, action: "master.create", entity: `master:${type}`, entityId: id, after: data, ip: meta.ip, userAgent: meta.userAgent });
    return id;
  });
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function insert<T extends MasterType>(tx: Tx, type: T, data: MasterInput<T>, key: string): Promise<string> {
  switch (type) {
    case "institutions": {
      const d = data as MasterInput<"institutions">;
      return (await tx.institution.create({ data: { name: d.name, nameKey: key, shortCode: d.shortCode, city: d.city, state: d.state, isPartner: d.isPartner ?? false } })).id;
    }
    case "degrees": {
      const d = data as MasterInput<"degrees">;
      return (await tx.degree.create({ data: { name: d.name, nameKey: key, level: d.level } })).id;
    }
    case "departments": {
      const d = data as MasterInput<"departments">;
      return (await tx.department.create({ data: { name: d.name, nameKey: key, shortCode: d.shortCode, aliases: { create: d.aliases.map((a) => ({ alias: a, aliasKey: nameKey(a) })) } } })).id;
    }
    case "batches": {
      const d = data as MasterInput<"batches">;
      return (await tx.batch.create({ data: { batchCode: d.batchCode, codeKey: key, year: d.year, startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null } })).id;
    }
    case "colour-teams": {
      const d = data as MasterInput<"colour-teams">;
      return (await tx.colourTeam.create({ data: { name: d.name, nameKey: key, hexColor: d.hexColor } })).id;
    }
    default: {
      const d = data as MasterInput<"statuses">;
      return (await tx.studentStatus.create({ data: { name: d.name, nameKey: key, color: d.color, isActiveState: d.isActiveState ?? true } })).id;
    }
  }
}

export async function updateMaster<T extends MasterType>(type: T, id: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const before = (await listMaster(type)).find((r) => r.id === id);
  if (!before) throw new HttpError(404, "Not found");
  const data = masterSchemas[type].parse(raw) as MasterInput<T>;
  const key = keyFor(type, data);
  await assertUnique(type, key, id);
  if (type === "departments") await assertAliasesFree((data as MasterInput<"departments">).aliases, id, key);
  await db.$transaction(async (tx) => {
    switch (type) {
      case "institutions": {
        const d = data as MasterInput<"institutions">;
        await tx.institution.update({ where: { id }, data: { name: d.name, nameKey: key, shortCode: d.shortCode ?? null, city: d.city ?? null, state: d.state ?? null, isPartner: d.isPartner ?? false } });
        break;
      }
      case "degrees": {
        const d = data as MasterInput<"degrees">;
        await tx.degree.update({ where: { id }, data: { name: d.name, nameKey: key, level: d.level } });
        break;
      }
      case "departments": {
        const d = data as MasterInput<"departments">;
        await tx.department.update({ where: { id }, data: { name: d.name, nameKey: key, shortCode: d.shortCode ?? null } });
        await tx.departmentAlias.deleteMany({ where: { departmentId: id } });
        if (d.aliases.length) await tx.departmentAlias.createMany({ data: d.aliases.map((a) => ({ alias: a, aliasKey: nameKey(a), departmentId: id })) });
        break;
      }
      case "batches": {
        const d = data as MasterInput<"batches">;
        await tx.batch.update({ where: { id }, data: { batchCode: d.batchCode, codeKey: key, year: d.year, startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null } });
        break;
      }
      case "colour-teams": {
        const d = data as MasterInput<"colour-teams">;
        await tx.colourTeam.update({ where: { id }, data: { name: d.name, nameKey: key, hexColor: d.hexColor ?? null } });
        break;
      }
      default: {
        const d = data as MasterInput<"statuses">;
        await tx.studentStatus.update({ where: { id }, data: { name: d.name, nameKey: key, color: d.color ?? null, isActiveState: d.isActiveState ?? true } });
      }
    }
    await audit(tx, { actorId: actor.id, action: "master.update", entity: `master:${type}`, entityId: id, before: before.fields, after: data, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function setMasterActive(type: MasterType, id: string, isActive: boolean, actor: SessionAdmin, meta: Meta) {
  const row = (await listMaster(type)).find((r) => r.id === id);
  if (!row) throw new HttpError(404, "Not found");
  if (!isActive && type === "statuses" && row.fields.isDefault) throw new HttpError(400, "The default status can't be deactivated");
  const data = { isActive };
  await db.$transaction(async (tx) => {
    if (type === "institutions") await tx.institution.update({ where: { id }, data });
    else if (type === "degrees") await tx.degree.update({ where: { id }, data });
    else if (type === "departments") await tx.department.update({ where: { id }, data });
    else if (type === "batches") await tx.batch.update({ where: { id }, data });
    else if (type === "colour-teams") await tx.colourTeam.update({ where: { id }, data });
    else await tx.studentStatus.update({ where: { id }, data });
    await audit(tx, { actorId: actor.id, action: isActive ? "master.activate" : "master.deactivate", entity: `master:${type}`, entityId: id, before: { isActive: row.isActive }, after: data, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Delete only if unused by any student, including soft-deleted ones (FK). Otherwise suggest deactivation (MST-02). */
export async function deleteMaster(type: MasterType, id: string, actor: SessionAdmin, meta: Meta) {
  const row = (await listMaster(type)).find((r) => r.id === id);
  if (!row) throw new HttpError(404, "Not found");
  const fk = { [type === "institutions" ? "institutionId" : type === "degrees" ? "degreeId" : type === "departments" ? "departmentId" : type === "batches" ? "batchId" : type === "colour-teams" ? "colourTeamId" : "statusId"]: id };
  const anyUse = await db.student.count({ where: fk });
  if (anyUse > 0) {
    throw new HttpError(409, `In use by ${anyUse} student record(s). Deactivate it instead.`, { inUse: anyUse, canDeactivate: true });
  }
  await db.$transaction(async (tx) => {
    if (type === "institutions") await tx.institution.delete({ where: { id } });
    else if (type === "degrees") await tx.degree.delete({ where: { id } });
    else if (type === "departments") await tx.department.delete({ where: { id } });
    else if (type === "batches") await tx.batch.delete({ where: { id } });
    else if (type === "colour-teams") await tx.colourTeam.delete({ where: { id } });
    else await tx.studentStatus.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: "master.delete", entity: `master:${type}`, entityId: id, before: row.fields, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Lookup maps used by the upload mapper (names, codes and department aliases → id). */
export async function masterLookups() {
  const [inst, deg, dept, aliases, batches, teams, statuses] = await Promise.all([
    db.institution.findMany({ where: { isActive: true } }),
    db.degree.findMany({ where: { isActive: true } }),
    db.department.findMany({ where: { isActive: true } }),
    db.departmentAlias.findMany({ where: { department: { isActive: true } } }),
    db.batch.findMany({ where: { isActive: true } }),
    db.colourTeam.findMany({ where: { isActive: true } }),
    db.studentStatus.findMany({ where: { isActive: true } }),
  ]);
  const m = (pairs: [string | null | undefined, string][]) => {
    const map = new Map<string, string>();
    for (const [k, id] of pairs) if (k) map.set(nameKey(k), id);
    return map;
  };
  return {
    institution: m([...inst.map((r) => [r.name, r.id] as [string, string]), ...inst.map((r) => [r.shortCode, r.id] as [string | null, string])]),
    degree: m(deg.map((r) => [r.name, r.id])),
    department: m([...dept.map((r) => [r.name, r.id] as [string, string]), ...dept.map((r) => [r.shortCode, r.id] as [string | null, string]), ...aliases.map((a) => [a.alias, a.departmentId] as [string, string])]),
    batch: m(batches.map((r) => [r.batchCode, r.id])),
    colourTeam: m(teams.map((r) => [r.name, r.id])),
    status: m(statuses.map((r) => [r.name, r.id])),
    defaultStatusId: statuses.find((s) => s.isDefault)?.id ?? null,
    batchYear: new Map(batches.map((b) => [b.id, b.year])),
  };
}
export type MasterLookups = Awaited<ReturnType<typeof masterLookups>>;

