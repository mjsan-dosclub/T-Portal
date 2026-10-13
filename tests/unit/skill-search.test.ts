import { describe, expect, it } from "vitest";
import { searchSkills, shortDescription, STARTER_SKILLS, type SkillOption } from "@/lib/skill-search";

const CAT: SkillOption[] = [
  { code: "PROG", name: "Programming/software development", category: "Software & Systems Engineering", description: "Developing software components to deliver value to stakeholders." },
  { code: "HCEV", name: "User experience design", category: "Product, Design & Experience", description: "Producing design concepts and prototypes for user interactions." },
  { code: "BINT", name: "Business intelligence", category: "Data, AI & Intelligent Systems", description: "Developing, producing and delivering management information." },
  { code: "VISL", name: "Data visualisation", category: "Data, AI & Intelligent Systems", description: "Facilitating understanding of data by displaying concepts." },
  { code: "DAAN", name: "Data analytics", category: "Data, AI & Intelligent Systems", description: "Enabling data-driven decision making." },
  { code: "PENT", name: "Penetration testing", category: "Security, Risk & Assurance", description: "Testing the effectiveness of security controls." },
  { code: "TEST", name: "Functional testing", category: "Software & Systems Engineering", description: "Assessing functional requirements." },
];
const codes = (q: string, ex: string[] = []) => searchSkills(CAT, q, ex).map((s) => s.code);

describe("Skill search for freshers (UX-2)", () => {
  it("UX-03 everyday words and tools find framework skills, with the matching word shown", () => {
    expect(codes("python")).toEqual(["PROG"]);
    expect(searchSkills(CAT, "Python")[0]!.via).toBe("python");
    expect(codes("figma")).toEqual(["HCEV"]);
    expect(codes("power bi").sort()).toEqual(["BINT", "VISL"]);
    expect(codes("ethical hacking")).toEqual(["PENT"]);
  });

  it("UX-04 ranking: name matches beat keyword matches; selected skills are excluded; empty query shows starters", () => {
    expect(codes("testing")[0]).toBe("TEST"); // "Functional testing" (name word) before keyword-only hits
    expect(codes("testing")).toContain("PENT"); // name word "testing" too
    expect(codes("data").slice(0, 2).sort()).toEqual(["DAAN", "VISL"]);
    expect(codes("data", ["DAAN"])).not.toContain("DAAN");
    expect(codes("")).toEqual(STARTER_SKILLS.filter((c) => CAT.some((x) => x.code === c)));
    expect(codes("zzqx")).toEqual([]);
    expect(shortDescription("First sentence here. Second one.")).toBe("First sentence here.");
  });
});
