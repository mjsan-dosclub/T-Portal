import { GuideSection, Steps, Tip, Toc } from "@/components/guide/guide";
import { db } from "@/lib/db";

export const metadata = { title: "How it works for students" };
export const dynamic = "force-dynamic";

// HELP-1 student guide. Public: shows only framework data (no personal data). Phase 1 = students don't sign in yet.
export default async function StudentGuide() {
  const [levels, workshops, roles, skills, categories, statuses] = await Promise.all([
    db.ontLevel.findMany({ orderBy: { n: "asc" } }),
    db.ontWorkshop.findMany({ orderBy: { n: "asc" } }),
    db.ontRole.count({ where: { isActive: true } }),
    db.ontSkill.count({ where: { isActive: true } }),
    db.ontCategory.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } }),
    db.studentStatus.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const meaning: Record<string, string> = {
    Active: "You are a current DOS Club member taking part in activities.",
    Inactive: "You're a member but not taking part right now.",
    Alumni: "You have completed your DOS Club journey.",
    Suspended: "Your participation is temporarily on hold.",
    Dropped: "You have left the programme.",
  };
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="glass card" style={{ padding: "2rem" }}>
        <div className="hint" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>For DOS Club students</div>
        <h1 className="page-title" style={{ marginTop: "0.35rem" }}>How the DOS Club Talent Portal works for you</h1>
        <p style={{ fontSize: "1.02rem", lineHeight: 1.6, marginTop: "0.6rem", maxWidth: "46rem" }}>
          DOS Club keeps one clean, secure record for every member and uses a skills framework built for <strong>Indian tech jobs</strong> to guide your learning. This page explains what we hold about you, how to keep it correct, and how to use the framework to plan your career.
        </p>
        <div className="banner" style={{ marginTop: "1rem" }}>
          ℹ Right now the portal is used by DOS Club coordinators. <strong>Student sign-in is coming in Phase 2</strong> (see below). You don&apos;t need an account today.
        </div>
      </section>

      <Toc items={[["record", "Your record"], ["correct", "Keep it correct"], ["status", "Your status"], ["skills", "Plan with the skills framework"], ["program", "27-Day Program"], ["privacy", "Your privacy"], ["next", "Coming next"], ["faq", "Questions"]]} />

      <GuideSection id="record" title="1. Your DOS Club record">
        <Steps
          items={[
            <>When you join DOS Club, a coordinator adds you to the portal, either one by one or from your college&apos;s list.</>,
            <>You get a permanent <strong>DOS student code</strong> like <span className="mono">DOS-2026-00042</span>. The year is your DOS Club batch year. Quote this code whenever you contact DOS Club.</>,
            <>Your record holds: <strong>name, email, mobile, gender (optional), date of birth (optional), institution, degree, department, year of study, graduation year, DOS Club batch, colour team, status, city/state, LinkedIn and GitHub links</strong>, and optionally a <strong>target job role</strong> from the skills framework.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="correct" title="2. Keep your details correct">
        <Steps
          items={[
            <>Check that your name is spelled as you want it shown (Tamil and other scripts are supported), and that your email and mobile are ones you use.</>,
            <>Spotted a mistake, changed your mobile number, or switched department? Tell your <strong>DOS Club coordinator</strong> with your student code and the correct detail.</>,
            <>Your coordinator updates it in the portal. Every change is recorded with who changed it and when.</>,
          ]}
        />
        <Tip>Each email and mobile number can belong to only one member. If yours &ldquo;already exists&rdquo;, you probably have an older record. Ask your coordinator to update that one instead of creating a new one.</Tip>
      </GuideSection>

      <GuideSection id="status" title="3. What your status means">
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{meaning[s.name] ?? "Ask your DOS Club coordinator what this status means for you."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">If your status looks wrong, contact your coordinator.</p>
      </GuideSection>

      <GuideSection id="skills" title="4. Plan your career with the skills framework">
        <p style={{ lineHeight: 1.6 }}>
          DOS Club&apos;s framework maps <strong>{skills} skills</strong> across <strong>{categories.length} areas</strong> to <strong>{roles} job roles</strong>, each with the level you need. The DOS Club team keeps it current as the Indian job market changes: new skills are added and outdated ones retired.
        </p>
        <Steps
          items={[
            <><strong>Pick a target role</strong> you want in 2–3 years (for example a cloud, data, security or AI role). Your coordinator can record it as your target role.</>,
            <><strong>Look at the skills that role needs</strong>, and the level for each.</>,
            <><strong>Be honest about your level today</strong> using the six levels below, and note the gaps.</>,
            <><strong>Close one gap at a time</strong> through projects, open-source contributions and DOS Club workshops, then move up a level.</>,
          ]}
        />
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }}>The six proficiency levels</h3>
        <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }} data-testid="guide-levels">
          {levels.map((l) => (
            <li key={l.n} style={{ display: "grid", gridTemplateColumns: "3rem 1fr", gap: "0.75rem", alignItems: "center", padding: "0.6rem 0.75rem", background: "var(--glass-strong)", borderRadius: "var(--r-lg)" }}>
              <span className="chip tone-accent mono" style={{ justifySelf: "start" }}>L{l.n}</span>
              <div>
                <strong>{l.name}</strong>
                <div className="hint">{l.description}</div>
              </div>
            </li>
          ))}
        </ol>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>The {categories.length} skill areas</summary>
          <ul style={{ columns: "16rem", paddingLeft: "1.2rem", marginTop: "0.5rem" }}>
            {categories.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        </details>
        <Tip>Most students start at <strong>L1 Foundation</strong> or <strong>L2 Practitioner</strong>. That&apos;s expected. The framework shows the path, not a judgement.</Tip>
      </GuideSection>

      <GuideSection id="program" title={`5. The ${workshops.length}-Day Program (Runway · CodeZap 3.0)`}>
        <p style={{ lineHeight: 1.6 }}>Each workshop day builds towards a target role and level. Attend in order where you can.</p>
        <ol style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))", gap: "0.6rem" }}>
          {workshops.map((w) => (
            <li key={w.n} style={{ padding: "0.7rem 0.85rem", background: "var(--glass-strong)", borderRadius: "var(--r-lg)", border: "1px solid var(--hairline)" }}>
              <span className="chip tone-accent mono">Day {w.n}</span>
              <div style={{ fontWeight: 600, marginTop: "0.35rem" }}>{w.title}</div>
              <div className="hint">{w.roleText}</div>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection id="privacy" title="6. How we protect your data">
        <ul style={{ paddingLeft: "1.2rem", display: "grid", gap: "0.4rem", lineHeight: 1.55 }}>
          <li>Only authorised DOS Club admins can see your record, and each signs in with a password <strong>and</strong> Google Authenticator.</li>
          <li>Admins see only what their role allows. Every change and export is logged.</li>
          <li>Deleted records go to a recycle bin first and are only removed permanently after 30 days.</li>
          <li>We handle your personal data in line with India&apos;s Digital Personal Data Protection Act, 2023. Your details are not shown on any public page.</li>
        </ul>
      </GuideSection>

      <GuideSection id="next" kicker="Phase 2" title="7. Coming next: your own student login">
        <p style={{ lineHeight: 1.6 }}>Later, you&apos;ll be able to sign in and build a job-portal style profile (similar to the profiles on popular Indian job sites):</p>
        <ul style={{ columns: "16rem", paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>Profile headline and summary</li>
          <li>Education history and scores</li>
          <li>Skills with your self-rated level (L1–L6)</li>
          <li>Projects with tech used and links</li>
          <li>Internships and experience</li>
          <li>Certifications</li>
          <li>Resume upload</li>
          <li>GitHub, LinkedIn and portfolio links</li>
          <li>Preferred roles, locations and availability</li>
          <li>Workshop attendance</li>
        </ul>
        <p className="hint">Until then, keep your details up to date through your coordinator.</p>
      </GuideSection>

      <GuideSection id="faq" title="Questions">
        {[
          ["Do I need to sign up?", "No. There's no student sign-up today. Your coordinator adds you."],
          ["I can't find my student code.", "Ask your DOS Club coordinator; they can look it up by your email or mobile."],
          ["Can I change my target role?", "Yes. Ask your coordinator. You can change it as your interests grow."],
          ["Why does my mobile show +91?", "Numbers are stored in the international format +91XXXXXXXXXX so they're always consistent."],
          ["Who do I contact about my data?", "Your DOS Club coordinator. Mention your student code."],
        ].map(([q, a]) => (
          <details key={q} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--hairline)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{q}</summary>
            <p style={{ marginTop: "0.35rem", lineHeight: 1.55 }}>{a}</p>
          </details>
        ))}
      </GuideSection>
    </div>
  );
}
