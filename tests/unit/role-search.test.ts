import { describe, expect, it } from "vitest";
import { isEntryRole, searchRoles, type RoleOption } from "@/lib/role-search";

const R = (name: string, category: string, levelMin: number, levelMax = 5): RoleOption => ({ id: name.toLowerCase().replace(/\W+/g, "-"), name, category, levelMin, levelMax });
const ROLES = [
  R("Software Engineer", "Software & Systems Engineering", 1, 6),
  R("Mobile Engineer", "Software & Systems Engineering", 2),
  R("Head of Engineering", "Software & Systems Engineering", 6, 6),
  R("QA / SDET Engineer", "Software & Systems Engineering", 2),
  R("UX Designer", "Product, Design & Experience", 1, 4),
  R("Data Analyst", "Data, AI & Intelligent Systems", 1, 3),
  R("Chief Technology Officer", "Strategy, Architecture & Innovation", 6, 6),
];
const names = (q: string, ex: string[] = []) => searchRoles(ROLES, q, ex).map((r) => r.name);

describe("Role search for freshers (UX-3)", () => {
  it("UX-06 job words find roles and say which word matched; entry-level roles first; empty = entry roles only", () => {
    expect(names("tester")).toEqual(["QA / SDET Engineer"]);
    expect(searchRoles(ROLES, "tester")[0]!.via).toBe("tester");
    expect(names("designer")).toEqual(["UX Designer"]);
    expect(names("developer").slice(0, 2)).toEqual(["Software Engineer", "Mobile Engineer"]);
    const eng = names("engineer");
    expect(eng.indexOf("Head of Engineering")).toBeGreaterThan(eng.indexOf("Mobile Engineer")); // entry-level ranks above leadership
    expect(names("")).toEqual(["Data Analyst", "Software Engineer", "UX Designer", "Mobile Engineer", "QA / SDET Engineer"]);
    expect(names("", ["data-analyst"])).not.toContain("Data Analyst");
    expect(isEntryRole(ROLES[6]!)).toBe(false);
  });
});
