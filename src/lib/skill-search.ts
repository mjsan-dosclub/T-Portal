// Skill search for students (UX-2). Freshers know tools and everyday words ("python", "figma", "power bi"),
// not framework skill names, so search matches those words too. Pure and unit-tested; every code here must
// exist in the ontology (tests/integration/skill-search.test.ts checks it against the database).

export type SkillOption = { code: string; name: string; category: string; description?: string };

/** Everyday words, tools and technologies → framework skill code. Lower-case. */
export const SKILL_KEYWORDS: Record<string, string[]> = {
  PROG: ["python", "java", "javascript", "typescript", "c++", "c programming", "c#", "coding", "programming", "react", "angular", "vue", "next.js", "node", "node.js", "express", "django", "flask", "spring", "spring boot", "php", "go", "golang", "rust", "kotlin", "swift", "flutter", "dart", "android", "ios", "app development", "web development", "full stack", "frontend", "backend", "html", "css", "dsa", "data structures", "algorithms", "competitive programming", "leetcode", "api", "rest api"],
  SWDN: ["oop", "object oriented", "design patterns", "software design", "clean code", "uml"],
  DESN: ["system design", "systems design", "low level design", "high level design", "architecture"],
  ARCH: ["solution architecture", "architecture", "system design", "microservices"],
  TEST: ["testing", "manual testing", "selenium", "unit testing", "junit", "pytest", "test cases", "qa", "cypress", "playwright"],
  NFTS: ["performance testing", "load testing", "jmeter", "security testing", "stress testing"],
  BPTS: ["uat", "user acceptance testing"],
  QUAS: ["quality assurance", "qa", "quality"],
  DBDS: ["sql", "mysql", "postgresql", "postgres", "mongodb", "database", "database design", "schema", "dbms", "firebase", "sqlite", "nosql"],
  DBAD: ["database administration", "dba", "oracle", "backup", "mysql admin"],
  DTAN: ["data modelling", "data modeling", "er diagram", "erd"],
  DAAN: ["data analysis", "data analytics", "excel", "advanced excel", "pandas", "sql", "analytics", "google sheets"],
  VISL: ["power bi", "tableau", "charts", "dashboard", "dashboards", "matplotlib", "seaborn", "visualisation", "visualization", "looker"],
  BINT: ["business intelligence", "power bi", "tableau", "reports", "bi", "dashboards"],
  DATS: ["data science", "statistics", "pandas", "numpy", "jupyter", "prediction", "kaggle", "r programming"],
  MLNG: ["machine learning", "ml", "scikit-learn", "sklearn", "tensorflow", "pytorch", "keras", "deep learning", "neural networks", "computer vision", "opencv", "nlp", "natural language processing", "cnn", "regression", "classification"],
  AITR: ["fine-tuning", "fine tuning", "model training", "hugging face", "transformers", "lora"],
  MLOP: ["mlops", "model deployment", "mlflow", "kubeflow"],
  LLMD: ["llm", "chatgpt", "openai", "gemini", "claude", "gen ai", "genai", "generative ai", "chatbot", "langchain", "gpt", "ai app"],
  PRMP: ["prompt", "prompting", "prompt engineering", "chatgpt", "prompts"],
  RAGE: ["rag", "retrieval", "langchain", "llamaindex", "vector search", "chat with documents", "pdf chatbot"],
  VECD: ["vector database", "pinecone", "faiss", "chroma", "embeddings", "semantic search", "weaviate"],
  AGEN: ["agents", "ai agents", "agentic", "autogen", "crewai", "langgraph", "automation", "n8n"],
  AISI: ["ai integration", "openai api", "chatbot integration", "ai api"],
  AIDE: ["ai ethics", "responsible ai", "bias", "fairness"],
  AIEV: ["model evaluation", "ai testing", "evals", "red teaming", "benchmark"],
  ANCC: ["data labelling", "data labeling", "annotation", "tagging"],
  DENG: ["data engineering", "etl", "spark", "pyspark", "airflow", "data pipelines", "big data", "kafka", "hadoop", "databricks", "snowflake"],
  DATM: ["data governance", "data quality", "data management"],
  ITOP: ["linux", "servers", "cloud", "aws", "azure", "gcp", "google cloud", "devops", "ec2", "cloud computing"],
  SYSP: ["linux", "windows server", "operating systems", "shell", "bash", "shell scripting", "ubuntu", "unix"],
  DEPL: ["deployment", "ci/cd", "cicd", "docker", "kubernetes", "k8s", "devops", "github actions", "jenkins", "hosting", "vercel", "netlify", "heroku"],
  CFMG: ["configuration management", "ansible", "terraform", "infrastructure as code", "iac", "git", "github", "version control", "gitlab"],
  RELM: ["release management", "releases", "versioning"],
  STMG: ["storage", "s3", "cloud storage", "backup"],
  IFDN: ["cloud architecture", "infrastructure", "aws", "azure", "network architecture"],
  AIIN: ["gpu", "cuda", "ai infrastructure"],
  NTDS: ["networking", "network design", "ccna", "tcp/ip", "computer networks"],
  NTAS: ["networking", "ccna", "router", "network troubleshooting", "lan", "wifi"],
  USUP: ["incident management", "on-call", "troubleshooting", "it support"],
  ASUP: ["application support", "technical support", "help desk", "l1 support", "l2 support"],
  CSMG: ["customer support", "service desk", "help desk", "customer service"],
  ITMG: ["itil", "it service management", "servicenow"],
  SCTY: ["cyber security", "cybersecurity", "security", "ceh", "security+", "information security"],
  PENT: ["ethical hacking", "penetration testing", "pentesting", "kali", "kali linux", "burp suite", "ctf", "metasploit"],
  VUAS: ["vulnerability", "nmap", "nessus", "owasp", "vapt"],
  VURE: ["bug bounty", "security research", "exploit"],
  SCAD: ["soc", "siem", "splunk", "security monitoring", "wazuh"],
  THIN: ["threat intelligence", "osint"],
  DGFS: ["forensics", "digital forensics", "autopsy"],
  CRIM: ["cyber crime", "cybercrime"],
  IAMT: ["authentication", "oauth", "iam", "access control", "sso", "jwt"],
  PEDP: ["gdpr", "data privacy", "dpdp", "compliance", "privacy"],
  GOVN: ["governance", "compliance", "policies"],
  BURM: ["risk", "risk management"],
  AUDT: ["audit", "auditing"],
  HCEV: ["ui", "ux", "ui/ux", "ui ux", "figma", "wireframes", "wireframing", "prototyping", "app design", "adobe xd", "web design", "user interface"],
  UNAN: ["ux analysis", "user flows", "personas"],
  URCH: ["user research", "user interviews", "surveys", "personas"],
  USEV: ["usability testing", "usability"],
  GRDN: ["graphic design", "canva", "photoshop", "illustrator", "poster design", "logo design", "coreldraw"],
  ADEV: ["game development", "unity", "unreal", "animation", "blender", "3d modelling", "3d", "ar", "vr", "ar/vr", "game design"],
  INCA: ["content writing", "technical writing", "blogging", "copywriting", "documentation", "writing"],
  ICPM: ["publishing", "wordpress", "cms", "blog"],
  KNOW: ["documentation", "wiki", "notion", "knowledge base"],
  ACIN: ["accessibility", "a11y", "inclusion"],
  CEXP: ["customer experience", "cx"],
  PROD: ["product management", "product manager", "roadmap", "product"],
  AIPM: ["ai product", "ai product management"],
  PRMG: ["project management", "jira", "trello", "agile", "scrum", "team lead", "planning", "pmp"],
  DEMG: ["delivery", "scrum master", "agile", "sprint"],
  REQM: ["requirements", "user stories", "srs", "business analyst", "ba"],
  BUSA: ["business analysis", "business analyst", "case study"],
  BPRE: ["process improvement", "lean", "six sigma"],
  BSMO: ["business model", "business modelling"],
  DIGM: ["digital marketing", "seo", "social media", "social media marketing", "instagram", "google ads", "sem", "meta ads", "linkedin marketing"],
  MKCM: ["campaigns", "email marketing", "marketing campaigns"],
  MKTG: ["marketing", "marketing strategy"],
  MRCH: ["market research", "surveys", "competitor analysis"],
  BRMG: ["branding", "brand"],
  PDMK: ["product marketing", "go-to-market", "gtm", "positioning"],
  SALE: ["sales", "business development", "bd", "lead generation"],
  SSUP: ["sales support", "crm", "salesforce", "hubspot"],
  CNSL: ["consulting", "consultancy", "advisory"],
  FIAN: ["financial analysis", "finance", "accounting", "tally", "financial modelling"],
  BUDF: ["budgeting", "forecasting"],
  RSCH: ["research", "research paper", "publication", "ieee", "paper", "thesis"],
  EMRG: ["tech trends", "emerging technology"],
  INOV: ["innovation", "startup", "hackathon", "ideation", "entrepreneurship"],
  IOTS: ["iot", "internet of things", "arduino", "raspberry pi", "sensors", "esp32", "esp8266", "smart home"],
  RESD: ["embedded", "embedded c", "embedded systems", "microcontroller", "rtos", "arduino", "8051", "stm32"],
  HWDE: ["hardware", "pcb", "circuit design", "vlsi", "verilog", "vhdl", "fpga", "electronics"],
  RFEN: ["rf", "antenna", "wireless", "communication systems"],
  ROBE: ["robotics", "ros", "drones", "robot"],
  BWEB: ["blockchain", "web3", "solidity", "ethereum", "smart contracts", "crypto", "nft"],
  HPCC: ["hpc", "parallel computing", "cuda", "mpi", "openmp"],
  NUAN: ["matlab", "numerical methods", "scilab"],
  SCMO: ["simulation", "matlab", "ansys", "modelling", "simulink", "cfd"],
  TEAC: ["teaching", "tutoring", "teaching assistant"],
  ETDL: ["training", "workshops", "mentoring", "conducting workshops"],
  TMCR: ["course creation", "e-learning", "curriculum"],
  RESC: ["recruitment", "hiring", "hr"],
  EEXP: ["employee engagement", "hr"],
  PDSV: ["mentoring", "career guidance"],
  OFCL: ["facilitation", "event management", "club leadership"],
  RLMT: ["stakeholder management", "client communication"],
  SINT: ["integration", "build"],
  SLEN: ["sdlc", "software lifecycle"],
  MEAS: ["metrics", "kpi", "kpis"],
  SUST: ["sustainability", "green tech", "esg"],
  SFEN: ["safety engineering"],
  AISA: ["ai architecture", "ai system design"],
  FDEP: ["solutions engineer", "client-facing engineering"],
};

/** Shown before the student types: common fresher skills. */
export const STARTER_SKILLS = ["PROG", "DBDS", "DAAN", "MLNG", "LLMD", "PRMP", "HCEV", "TEST", "DEPL", "SCTY", "VISL", "PRMG"];

export type SkillMatch = SkillOption & { via?: string };

/** Ranked search: name start > name word > keyword > category/description. Returns at most `limit`. */
export function searchSkills(catalog: SkillOption[], query: string, exclude: string[] = [], limit = 30): SkillMatch[] {
  const skip = new Set(exclude);
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) {
    const byCode = new Map(catalog.map((c) => [c.code, c]));
    return STARTER_SKILLS.map((c) => byCode.get(c)).filter((c): c is SkillOption => !!c && !skip.has(c.code)).slice(0, limit);
  }
  const scored: { s: SkillMatch; score: number }[] = [];
  for (const c of catalog) {
    if (skip.has(c.code)) continue;
    const name = c.name.toLowerCase();
    let score = 0;
    let via: string | undefined;
    if (name.startsWith(q)) score = 100;
    else if (name.split(/[\s/()-]+/).some((w) => w.startsWith(q))) score = 80;
    else if (name.includes(q)) score = 60;
    const kw = SKILL_KEYWORDS[c.code] ?? [];
    const exact = kw.find((k) => k === q);
    const partial = exact ?? (q.length >= 2 ? kw.find((k) => k.startsWith(q) || (q.length >= 3 && k.includes(q))) : undefined);
    if (exact && score < 90) { score = 90; via = exact; }
    else if (partial && score < 50) { score = 50; via = partial; }
    if (!score && q.length >= 3 && (c.category.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q))) score = 20;
    if (score) scored.push({ s: { ...c, via }, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name)).slice(0, limit).map((x) => x.s);
}

/** First sentence of a skill description, shortened for one line. */
export function shortDescription(d: string | undefined, max = 110) {
  if (!d) return "";
  const first = d.split(/(?<=\.)\s/)[0] ?? d;
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}
