// Role search for students (UX-3). Freshers search with everyday job words ("developer", "tester", "designer");
// entry-level roles come first. Keys are role names (roles have no stable code); every name here is checked
// against the ontology in tests/integration/skill-search.test.ts (UX-07).

export type RoleOption = { id: string; name: string; category: string; levelMin: number; levelMax: number };

/** A role a fresher can realistically start in: its ladder begins at L1 or L2. */
export const isEntryRole = (r: Pick<RoleOption, "levelMin">) => r.levelMin <= 2;

/** Everyday job words → role names. Lower-case words. */
export const ROLE_KEYWORDS: Record<string, string[]> = {
  "Software Engineer": ["developer", "software developer", "programmer", "coder", "sde", "full stack", "backend", "frontend", "web developer", "java developer", "python developer", "it job"],
  "GenAI-Assisted Software Engineer": ["developer", "ai coding", "copilot", "vibe coding", "genai developer"],
  "Mobile Engineer": ["android developer", "ios developer", "app developer", "flutter developer", "mobile developer", "react native"],
  "QA / SDET Engineer": ["tester", "testing", "qa", "quality", "automation tester", "manual tester", "sdet", "selenium"],
  "Data Analyst": ["analyst", "data", "excel", "power bi", "tableau", "sql", "mis", "reporting"],
  "Data Scientist": ["data", "ml", "machine learning", "statistics", "ai"],
  "Data Engineer": ["data", "etl", "big data", "spark", "pipelines"],
  "ML Engineer": ["ml", "machine learning", "ai", "deep learning", "ai engineer"],
  "Agentic AI Engineer": ["ai", "ai agents", "agents", "genai", "llm", "ai engineer", "chatbot"],
  "LLMOps Engineer": ["ai", "llm", "genai", "mlops"],
  "MLOps Engineer": ["ai", "ml", "mlops", "deployment"],
  "Cloud Engineer": ["cloud", "aws", "azure", "gcp", "devops", "infrastructure"],
  "DevOps Engineer": ["devops", "cloud", "docker", "kubernetes", "ci/cd", "linux"],
  "Database Administrator": ["dba", "database", "sql", "oracle"],
  "FinOps Engineer": ["cloud cost", "finops", "cloud"],
  "Site Reliability Engineer": ["sre", "reliability", "devops", "on-call"],
  "Platform Engineer": ["platform", "devops", "infrastructure"],
  "Security Analyst": ["cyber security", "cybersecurity", "security", "hacker", "ethical hacking", "infosec"],
  "SOC Analyst": ["soc", "cyber security", "security", "siem", "monitoring"],
  "Penetration Tester": ["ethical hacker", "hacker", "pentester", "ethical hacking", "bug bounty", "security"],
  "GRC / Compliance Analyst": ["compliance", "audit", "risk", "grc", "iso 27001"],
  "AI Security Engineer": ["ai security", "security", "ai"],
  "UX Designer": ["designer", "ui", "ux", "ui/ux", "figma", "web designer", "app designer"],
  "Product Designer": ["designer", "ui", "ux", "figma", "product design"],
  "UX Researcher": ["user research", "ux", "research"],
  "Product Manager": ["product", "pm", "apm", "associate product manager"],
  "AI Product Manager": ["product", "ai", "pm"],
  "Business Analyst": ["analyst", "ba", "business", "requirements", "consultant"],
  "Project Manager": ["project", "manager", "coordinator", "pmo"],
  "Scrum Master / Agile Coach": ["scrum", "agile", "scrum master"],
  "Account Executive": ["sales", "bde", "business development", "inside sales"],
  "Customer Success Manager": ["customer success", "client", "support", "customer"],
  "Pre-Sales/Solutions Consultant": ["pre-sales", "presales", "solutions", "consultant", "technical sales"],
  "Bid & Proposal Manager": ["proposal", "tender", "bids"],
  "Content Strategist/SEO Analyst": ["content", "seo", "writer", "content writer", "blogger", "copywriter"],
  "Digital/Performance Marketing Specialist": ["digital marketing", "marketing", "social media", "ads", "seo", "performance marketing"],
  "Growth Marketing Manager": ["growth", "marketing", "startup"],
  "Talent Acquisition Specialist": ["hr", "recruiter", "recruitment", "hiring", "talent"],
  "HR Business Partner": ["hr", "human resources", "people"],
  "Learning Experience Designer": ["instructional designer", "e-learning", "trainer", "course", "teaching"],
  "AR/VR/XR Developer": ["ar", "vr", "xr", "game developer", "unity", "metaverse", "developer"],
  "Blockchain/Web3 Developer": ["blockchain", "web3", "crypto", "solidity", "developer"],
  "Green Software Engineer": ["sustainability", "green", "developer"],
  "Robotics Software Engineer": ["robotics", "ros", "automation", "embedded", "drones"],
  "IoT Solutions Architect": ["iot", "embedded", "arduino", "electronics"],
  "Quantum Software Engineer": ["quantum", "qiskit"],
  "Forward Deployed AI Engineer": ["ai", "client", "solutions engineer"],
  "Solution Architect": ["architect", "architecture"],
  "Cloud Architect": ["architect", "cloud"],
};

export type RoleMatch = RoleOption & { via?: string };

/** Ranked role search. Empty query → entry-level roles. Ties go to entry-level roles, then by name. */
export function searchRoles(roles: RoleOption[], query: string, exclude: string[] = [], limit = 30): RoleMatch[] {
  const skip = new Set(exclude);
  const pool = roles.filter((r) => !skip.has(r.id));
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  const order = (a: RoleOption, b: RoleOption) => a.levelMin - b.levelMin || a.name.localeCompare(b.name);
  if (!q) return pool.filter(isEntryRole).sort(order).slice(0, limit);
  const scored: { r: RoleMatch; score: number }[] = [];
  for (const r of pool) {
    const name = r.name.toLowerCase();
    let score = 0;
    let via: string | undefined;
    if (name.startsWith(q)) score = 100;
    else if (name.split(/[\s/&()-]+/).some((w) => w.startsWith(q))) score = 80;
    else if (name.includes(q)) score = 60;
    const kw = ROLE_KEYWORDS[r.name] ?? [];
    const exact = kw.find((k) => k === q);
    const partial = exact ?? (q.length >= 2 ? kw.find((k) => k.startsWith(q) || (q.length >= 3 && k.includes(q))) : undefined);
    if (exact && score < 90) { score = 90; via = exact; }
    else if (partial && score < 50) { score = 50; via = partial; }
    if (!score && q.length >= 3 && r.category.toLowerCase().includes(q)) score = 20;
    if (score) scored.push({ r: { ...r, via }, score: score + (isEntryRole(r) ? 5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score || order(a.r, b.r)).slice(0, limit).map((x) => x.r);
}
