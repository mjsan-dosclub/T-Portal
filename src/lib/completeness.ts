// Profile completeness per section (DECISIONS PRF-3). Pure so it's unit-tested and shared by student, admin and insights.

export type SectionKey =
  | "personal" | "headline" | "summary" | "education" | "skills" | "projects"
  | "internships" | "certifications" | "accomplishments" | "preferences" | "resume" | "links";

export const SECTIONS: { key: SectionKey; label: string; weight: number }[] = [
  { key: "personal", label: "Personal details", weight: 5 },
  { key: "headline", label: "Resume headline", weight: 5 },
  { key: "summary", label: "Profile summary", weight: 10 },
  { key: "education", label: "Education", weight: 15 },
  { key: "skills", label: "Key skills", weight: 15 },
  { key: "projects", label: "Projects", weight: 10 },
  { key: "internships", label: "Internships", weight: 5 },
  { key: "certifications", label: "Certifications", weight: 10 },
  { key: "accomplishments", label: "Accomplishments", weight: 5 },
  { key: "preferences", label: "Career preferences", weight: 10 },
  { key: "resume", label: "Resume", weight: 5 },
  { key: "links", label: "Online profiles", weight: 5 },
];

export type ProfileFacts = {
  gender: boolean;
  dateOfBirth: boolean;
  cityState: boolean;
  languages: number;
  headlineLength: number;
  summaryLength: number;
  educationLevels: string[]; // e.g. ["CLASS_10","CLASS_12","UG"]
  hasRole: boolean;
  requiredSkills: number;
  ratedRequired: number;
  tools: number;
  projects: number;
  internships: number;
  certifications: number;
  accomplishments: number;
  prefRoles: number;
  prefLocations: number;
  jobTypes: number;
  workModes: number;
  availableFrom: boolean;
  resume: boolean;
  links: number;
};

export type SectionScore = { key: SectionKey; label: string; weight: number; score: number; missing: string[] };

const part = (ok: boolean, missing: string, list: string[]) => {
  if (!ok) list.push(missing);
  return ok ? 1 : 0;
};

/** Each section returns 0..1 plus what's missing, so the UI can say exactly what to add. */
export function scoreSections(f: ProfileFacts): SectionScore[] {
  const rules: Record<SectionKey, () => { score: number; missing: string[] }> = {
    personal: () => {
      const m: string[] = [];
      const n = part(f.gender, "gender", m) + part(f.dateOfBirth, "date of birth", m) + part(f.cityState, "current city & state", m) + part(f.languages > 0, "a language you know", m);
      return { score: n / 4, missing: m };
    },
    headline: () => (f.headlineLength >= 20 ? { score: 1, missing: [] } : { score: 0, missing: ["a one-line headline (20+ characters)"] }),
    summary: () => (f.summaryLength >= 150 ? { score: 1, missing: [] } : f.summaryLength >= 50 ? { score: 0.5, missing: ["a longer summary (150+ characters)"] } : { score: 0, missing: ["a profile summary"] }),
    education: () => {
      const m: string[] = [];
      const lv = new Set(f.educationLevels);
      const n = part(lv.has("CLASS_10"), "Class 10", m) + part(lv.has("CLASS_12") || lv.has("DIPLOMA"), "Class 12 or Diploma", m) + part(lv.has("UG") || lv.has("PG"), "your degree (UG/PG)", m);
      return { score: n / 3, missing: m };
    },
    skills: () => {
      const m: string[] = [];
      const n =
        part(f.hasRole, "a target role", m) +
        part(f.requiredSkills > 0 && f.ratedRequired >= f.requiredSkills, "ratings for every skill your role needs", m) +
        part(f.tools >= 3, "at least 3 technical skills / tools", m);
      return { score: n / 3, missing: m };
    },
    projects: () => (f.projects >= 2 ? { score: 1, missing: [] } : f.projects === 1 ? { score: 0.5, missing: ["a second project"] } : { score: 0, missing: ["a project"] }),
    internships: () => (f.internships >= 1 ? { score: 1, missing: [] } : { score: 0, missing: ["an internship"] }),
    certifications: () => (f.certifications >= 1 ? { score: 1, missing: [] } : { score: 0, missing: ["a certification"] }),
    accomplishments: () => (f.accomplishments >= 1 ? { score: 1, missing: [] } : { score: 0, missing: ["an award, hackathon, publication or contribution"] }),
    preferences: () => {
      const m: string[] = [];
      const n = part(f.prefRoles > 0, "preferred roles", m) + part(f.prefLocations > 0, "preferred locations", m) + part(f.jobTypes > 0, "job type", m) + part(f.workModes > 0, "work mode", m) + part(f.availableFrom, "available-from date", m);
      return { score: n / 5, missing: m };
    },
    resume: () => (f.resume ? { score: 1, missing: [] } : { score: 0, missing: ["your resume (PDF)"] }),
    links: () => (f.links >= 1 ? { score: 1, missing: [] } : { score: 0, missing: ["LinkedIn, GitHub or a portfolio link"] }),
  };
  return SECTIONS.map((s) => ({ ...s, ...rules[s.key]() }));
}

/** Overall % = Σ weight × section score, rounded. */
export function overallCompleteness(sections: SectionScore[]) {
  return Math.round(sections.reduce((n, s) => n + s.weight * s.score, 0));
}
