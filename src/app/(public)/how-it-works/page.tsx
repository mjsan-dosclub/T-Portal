import Link from "next/link";
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
          ✓ <strong>You can now sign in</strong> to see your own record. First time? <Link href="/student/activate">Set up your account</Link>. Already set up? <Link href="/student/login">Sign in</Link>.
        </div>
      </section>

      <Toc items={[["signin", "Sign in"], ["record", "Your record"], ["correct", "Keep it correct"], ["status", "Your status"], ["skills", "Plan with the skills framework"], ["program", "27-Day Program"], ["internships", "Internship reports"], ["privacy", "Your privacy"], ["next", "Coming next"], ["faq", "Questions"]]} />

      <GuideSection id="signin" kicker="Student portal" title="0. Set up your account and sign in">
        <Steps
          items={[
            <>Open <Link href="/student/activate">First-time access</Link>. Enter the <strong>email</strong> and <strong>mobile number</strong> you registered with DOS Club, and create a password (at least 12 characters).</>,
            <>Install <strong>Google Authenticator</strong> on your phone. Scan the QR code shown, type the 6-digit code, and save your <strong>10 recovery codes</strong> somewhere safe.</>,
            <>Next time: <Link href="/student/login">Sign in</Link> with your email and password, then the current code from Google Authenticator.</>,
            <>Change your password any time from <strong>Account</strong>.</>,
            <>Build your <strong>My profile</strong> like a job-portal profile: personal details, headline &amp; summary, education (Class 10, 12/Diploma, degree), key skills and tools (5+ for full marks), projects, internships, <strong>certifications</strong>, accomplishments, career preferences, resume (PDF) and links. Each section shows its own %, and <strong>Profile strength</strong> shows your total. Aim for 80%+.</>,
            <>Your <strong>Career plan</strong> is separate from your profile: choose a target role, rate yourself on the skills it needs and follow its roadmap. It doesn&apos;t change your profile %.</>,
            <>Assigned to an <strong>international internship</strong>? Open <strong>Internships</strong> to see the program and upload a <strong>weekly work report</strong> (see section 6).</>,
            <><strong>Forgot your password?</strong> Ask your DOS Club coordinator. They&apos;ll give you a one-time password (valid 72 hours). Sign in with it plus your authenticator code, and you&apos;ll be asked to create a new password.</>,
          ]}
        />
        <Tip>If first-time access says it couldn&apos;t activate, check that the email and mobile match what you gave DOS Club. If you never activated but it says you have, tell your coordinator straight away.</Tip>
      </GuideSection>

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
            <><strong>Pick a target role</strong> you want in 2–3 years (for example a cloud, data, security or AI role) on your <strong>Career plan</strong> page.</>,
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

      <GuideSection id="internships" kicker="International internships" title="6. Weekly reports for your internship">
        <Steps
          items={[
            <>When DOS Club assigns you to a client&apos;s internship, it appears under <strong>Internships</strong> with the company, description, location, duration and dates.</>,
            <>Every week, press <strong>Upload report</strong> for that week and attach your work report: <strong>PDF, Word, Excel, PowerPoint, CSV, TXT, RTF or OpenDocument</strong>, up to 10 MB. <strong>ZIP and other compressed files aren&apos;t accepted</strong>, and a file renamed to a different extension is rejected.</>,
            <>Each submitted or accepted report counts as your <strong>attendance</strong> for that week. A report sent after its due date is marked late but still counts.</>,
            <>Your coordinator reviews each report. If it says <strong>Needs revision</strong>, read the feedback and upload a new version; until then that week doesn&apos;t count. Accepted reports are locked.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="privacy" title="7. How we protect your data">
        <ul style={{ paddingLeft: "1.2rem", display: "grid", gap: "0.4rem", lineHeight: 1.55 }}>
          <li>Only authorised DOS Club admins can see your record, and each signs in with a password <strong>and</strong> Google Authenticator.</li>
          <li>Admins see only what their role allows. Every change and export is logged.</li>
          <li>Deleted records go to a recycle bin first and are only removed permanently after 30 days.</li>
          <li>We handle your personal data in line with India&apos;s Digital Personal Data Protection Act, 2023. Your details are not shown on any public page.</li>
        </ul>
      </GuideSection>

      <GuideSection id="next" kicker="Coming next" title="8. Coming next">
        <p style={{ lineHeight: 1.6 }}>Your full job-portal style profile is already on My profile. Coming later:</p>
        <ul style={{ columns: "16rem", paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>Job and internship listings matched to your target role</li>
          <li>Applying to partner openings with your profile</li>
          <li>Interview and placement updates</li>
        </ul>
        <p className="hint">Until then, your record is read-only. Ask your coordinator for corrections.</p>
      </GuideSection>

      <GuideSection id="faq" title="Questions">
        {[
          ["Do I need to sign up?", "No. Your coordinator adds you to DOS Club. You only do first-time access with your registered email and mobile."],
          ["I forgot my password.", "Ask your DOS Club coordinator for a one-time password. You'll set a new password after signing in."],
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
