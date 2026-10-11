import Link from "next/link";
import { GuideSection, Kbd, Shot, Steps, Tip, Toc } from "@/components/guide/guide";
import { canExport, requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../page-header";

export const metadata = { title: "How it works" };

// HELP-1: admin guide, role-aware. Every step names the real button/label in the app.

export default async function HelpPage() {
  const me = await requirePageAdmin();
  const sa = me.role === "SUPER_ADMIN";
  const editor = me.role !== "VIEWER";
  const toc: [string, string][] = [
    ["start", "Sign in"],
    ["roles", "Your role"],
    ["find", "Find students"],
    ...(editor
      ? ([
          ["add", "Add a student"],
          ["upload", "Upload a spreadsheet"],
          ["bulk", "Bulk status & delete"],
          ["masters", "Masters"],
          ["ontology", "Update the ontology"],
          ["portal", "Student portal access"],
        ] as [string, string][])
      : []),
    ...(canExport(me) ? ([["export", "Export"]] as [string, string][]) : []),
    ...(sa ? ([["super", "Super Admin tasks"]] as [string, string][]) : []),
    ["help", "Problems & answers"],
    ["privacy", "Privacy rules"],
  ];
  const roleLabel = sa ? "Super Admin" : editor ? "Admin" : "Viewer";

  return (
    <>
      <PageHeader
        title="How it works"
        subtitle={<>A step-by-step guide for your role: <strong>{roleLabel}</strong>. Students have their own guide at <Link href="/how-it-works">/how-it-works</Link>, which you can share with them.</>}
      />
      <Toc items={toc} />

      <GuideSection id="start" kicker="Step 0" title="Sign in safely with Google Authenticator">
        <Steps
          items={[
            <>Open the portal and enter your <Kbd>Email</Kbd> and <Kbd>Password</Kbd>, then press <Kbd>Continue</Kbd>. A Super Admin gives you a one-time password when your account is created.</>,
            <>
              <strong>First time only:</strong> install <strong>Google Authenticator</strong> on your phone, tap <Kbd>+</Kbd> → <Kbd>Scan a QR code</Kbd>, scan the code on screen, and type the 6-digit number it shows.
            </>,
            <>Save the <strong>10 recovery codes</strong> shown once (password manager or printed). Each works once if you lose your phone.</>,
            <>Every sign-in after that: password, then the current 6-digit code from the app. Codes change every 30 seconds, and a code can be used only once.</>,
          ]}
        />
        <Tip>Change your password and generate fresh recovery codes any time from <Link href="/account">Account</Link>. You are signed out after 30 minutes of inactivity, and after 8 hours in any case.</Tip>
      </GuideSection>

      <GuideSection id="roles" title="What each role can do">
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr><th>Task</th><th>Super Admin</th><th>Admin</th><th>Viewer</th></tr>
            </thead>
            <tbody>
              {[
                ["View students, dashboard, ontology", "✓", "✓", "✓"],
                ["Add, edit, upload students", "✓", "✓", "—"],
                ["Bulk status change, delete (with undo)", "✓", "✓", "—"],
                ["Manage masters (institutions, departments…)", "✓", "✓", "—"],
                ["Add / retire skills and roles in the ontology", "✓", "✓", "—"],
                ["Export to CSV", "✓", "✓", "If allowed"],
                ["Recycle Bin restore / purge", "✓", "—", "—"],
                ["Audit log, admin users, reset someone's 2FA", "✓", "—", "—"],
              ].map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} style={i ? { textAlign: "center" } : undefined}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GuideSection>

      <GuideSection id="find" title="Find and view students">
        <Steps
          items={[
            <>Open <Link href="/students">Students</Link>. Type part of a <strong>name, email, phone or student code</strong> in the search box. Results update as you type.</>,
            <>Narrow down with the filters: <Kbd>Institution</Kbd> <Kbd>Department</Kbd> <Kbd>Degree</Kbd> <Kbd>Batch</Kbd> <Kbd>Team</Kbd> <Kbd>Status</Kbd> <Kbd>Grad. year</Kbd>. Click a column title to sort; click again to reverse.</>,
            <>Press <Kbd>Preview</Kbd> on a row to see the full record in a side panel without changing anything. Press <Kbd>Esc</Kbd> to close.</>,
            <>Use <Kbd>Columns</Kbd> to hide columns you don&apos;t need. The portal remembers your choice.</>,
          ]}
        />
        <Shot src="/help/students.jpg" alt="Students table with filters, a selected page and the bulk action bar" caption="Students: search, filters, row actions, and the dark bulk-action bar that appears when you tick rows." />
      </GuideSection>

      {editor && (
        <>
          <GuideSection id="add" title="Add or edit one student">
            <Steps
              items={[
                <>Click <Kbd>Add student</Kbd> (top right of Students or Home).</>,
                <>Fill the required fields marked <strong>*</strong>: full name, email, mobile, institution, degree, department, graduation year, DOS Club batch and status. Mobile numbers are saved as <span className="mono">+91XXXXXXXXXX</span>.</>,
                <>If the email or mobile already belongs to someone, a banner links you to that student. Open it instead of creating a duplicate.</>,
                <>Press <Kbd>Add student</Kbd>. A permanent code like <span className="mono">DOS-2026-00042</span> is created (the year comes from the DOS Club batch).</>,
                <>To change details later: <Kbd>Edit</Kbd> on the row → change → <Kbd>Save changes</Kbd>. If another admin saved the same student meanwhile, you&apos;ll see both versions side by side and choose.</>,
              ]}
            />
            <Tip>Dropdowns only show <strong>active</strong> master values. If an institution or department is missing, add it in <Link href="/masters/institutions">Masters</Link> first.</Tip>
          </GuideSection>

          <GuideSection id="upload" title="Upload many students from Excel or CSV">
            <Steps
              items={[
                <>Go to <Link href="/students/upload">Upload</Link> and download the <Kbd>Excel template (.xlsx)</Kbd> or <Kbd>CSV template</Kbd>. Keep the header row exactly as it is.</>,
                <>Fill one student per row. Institution, degree, department and batch must match names in Masters. Department short codes and aliases like <em>CSE</em> also work. Format the phone column as <strong>Text</strong> in Excel so numbers don&apos;t turn into 9.18E+11.</>,
                <>Drop the file onto the upload box (max 10,000 rows / 5 MB). The portal checks every row and shows <strong>Valid</strong>, <strong>Already exists</strong>, <strong>Duplicate in file</strong> and <strong>Errors</strong>, with the reason next to each cell.</>,
                <>If a value isn&apos;t recognised (e.g. &ldquo;Comp Sci&rdquo;), use <Kbd>Map unknown values</Kbd> to pick the right master value, or reject it, then <Kbd>Apply mapping &amp; re-check</Kbd>.</>,
                <>For students who already exist, choose <Kbd>Skip</Kbd> or <Kbd>Update existing</Kbd> (per row, or <Kbd>Update all</Kbd>).</>,
                <>Press <Kbd>Import now</Kbd>. Afterwards press <Kbd>Download error report</Kbd> for rows that need fixing, fix them in your sheet, and upload just those rows again.</>,
              ]}
            />
            <Shot src="/help/upload.jpg" alt="Upload preview showing counts, the mapping step and rows with errors" caption="Upload preview: counts at the top, the mapping step for unknown values, and per-row problems." />
            <Tip>You can leave half-way. Your upload is saved, and <Kbd>Your recent uploads</Kbd> lets you continue later.</Tip>
          </GuideSection>

          <GuideSection id="bulk" title="Change status or delete many students at once">
            <Steps
              items={[
                <>Tick the box on each row, or the box in the header to select the <strong>whole page</strong>. To include every student matching your filters (not just this page), click <Kbd>Select all N matching</Kbd> in the blue banner.</>,
                <><strong>Change status:</strong> in the dark bar press <Kbd>Update status</Kbd>, choose the new status (e.g. Alumni), add a reason (saved in the audit log), check the count, and confirm.</>,
                <><strong>Delete:</strong> press <Kbd>Delete</Kbd>. For more than 10 students you must type <span className="mono">DELETE</span>. Deleted students go to the Recycle Bin, not away for good.</>,
                <>Made a mistake? Press <Kbd>Undo</Kbd> in the message at the bottom within 10 seconds. Later, ask a Super Admin to restore from the Recycle Bin.</>,
              ]}
            />
            <Tip tone="warn">&ldquo;Select all N matching&rdquo; acts on every student behind your current filters. Check the number in the dialog before confirming.</Tip>
          </GuideSection>

          <GuideSection id="masters" title="Masters: keep lists clean">
            <p>
              Masters are the fixed lists students are linked to: <strong>Institutions, Degrees, Departments, DOS Club Batches, Colour Teams, Student Statuses</strong>. Because students pick from these lists instead of typing, there&apos;s no &ldquo;CSE&rdquo; vs &ldquo;Computer Sci&rdquo; mess.
            </p>
            <Steps
              items={[
                <>Open <Link href="/masters/institutions">Masters</Link>, choose a tab, and press <Kbd>Add …</Kbd> or <Kbd>Edit</Kbd>. Names are unique regardless of capitals or extra spaces.</>,
                <>For departments, add <strong>aliases</strong> separated by <span className="mono">;</span> (e.g. <em>CSE; Computer Science; Comp Sci</em>). Uploads then recognise those spellings automatically.</>,
                <>A value used by students can&apos;t be deleted. Use <Kbd>Deactivate</Kbd>: it disappears from new-student dropdowns but stays on existing records.</>,
                <>To add many at once, use <Kbd>Import CSV</Kbd>. Download the template, upload, check the preview, then import.</>,
              ]}
            />
          </GuideSection>

          <GuideSection id="ontology" kicker="New" title="Keep the Skills Ontology up to date">
            <p>The ontology is DOS Club&apos;s framework of skills and job roles for the Indian market. Update it whenever the industry changes.</p>
            <Steps
              items={[
                <>Open <Link href="/ontology/manage">Skills Ontology → Manage</Link>.</>,
                <><strong>New skill:</strong> <Kbd>Skills</Kbd> tab → <Kbd>Add skill</Kbd>. Give a short unique code (3–6 letters, e.g. <span className="mono">PRMT</span>), name, description, category and subcategory. Codes are permanent and can&apos;t be reused. Need a new subcategory? Add it first on the <Kbd>Subcategories</Kbd> tab.</>,
                <><strong>Use it in roles:</strong> <Kbd>Roles</Kbd> tab → <Kbd>Skills</Kbd> on a role → <Kbd>Add a skill</Kbd>, choose the level L1–L6 → <Kbd>Save skills</Kbd>. New job roles can be added with <Kbd>Add role</Kbd>.</>,
                <><strong>Remove an old skill:</strong> press <Kbd>Retire</Kbd> and give a reason (e.g. &ldquo;Replaced by AGNT&rdquo;). If roles still need it, the portal lists them. Tick <em>Also remove it from these roles</em>, or update those roles first.</>,
                <>Retired skills and roles disappear from the explorers but are kept in history. Change your mind? Filter by <Kbd>Retired</Kbd> and press <Kbd>Restore</Kbd>. Only a skill added in the portal by mistake and never used by a role can be deleted permanently.</>,
                <>The <Kbd>Change log</Kbd> tab shows who changed what and why.</>,
              ]}
            />
            <Shot src="/help/ontology-manage.jpg" alt="Ontology manage page with the skills list and retire actions" caption="Manage: skills list with Edit / Retire / Restore, plus Roles, Subcategories and Change log tabs." />
          </GuideSection>
        </>
      )}

      {editor && (
        <GuideSection id="portal" kicker="Phase 2" title="Student portal access">
          <p>Students can sign in to see their own record. No email service is used, so you invite them and help with passwords yourself.</p>
          <Steps
            items={[
              <><strong>Invite:</strong> on <Link href="/students">Students</Link> press <Kbd>Invitation message</Kbd> → <Kbd>Copy message</Kbd> and paste it into WhatsApp groups. It contains only links, no personal data.</>,
              <>Students do <strong>first-time access</strong> themselves with their registered <strong>email and mobile</strong>, create a password and set up Google Authenticator. Keep their mobile numbers correct in the student master, or they can&apos;t activate.</>,
              <><strong>Check status:</strong> <Kbd>Preview</Kbd> a student. The <em>Student portal</em> line shows whether they activated, have the authenticator, and when they last signed in.</>,
              <><strong>Forgot password:</strong> confirm it&apos;s really the student (e.g. call their registered mobile), then <Kbd>Preview</Kbd> → <Kbd>Reset password</Kbd> → <Kbd>Confirm</Kbd>. Share the <strong>one-time password</strong> privately; it&apos;s shown once and works for 72 hours. They&apos;ll be made to choose a new password after signing in.</>,
              ...(sa ? [<><strong>Lost phone and recovery codes:</strong> <Kbd>Reset portal access</Kbd> removes their portal account (logged). They then do first-time access again.</>] : []),
            ]}
          />
          <Tip tone="warn">If a student says &ldquo;couldn&apos;t activate&rdquo; but never set up an account, someone else may have used their email and mobile. A Super Admin should reset their portal access at once and check the audit log.</Tip>
        </GuideSection>
      )}

      {canExport(me) && (
        <GuideSection id="export" title="Export to CSV">
          <p>
            On Students use <Kbd>Export all</Kbd> / <Kbd>Export filtered</Kbd>, or select rows and press <Kbd>Export selected</Kbd>. Exports contain code, name, email, phone, institution, degree, department, batch, graduation year, status and team. Notes and date of birth are never exported. Every export is logged. Cells that start with + = - @ get a leading apostrophe so spreadsheet formulas can&apos;t run.
          </p>
          <Tip tone="warn">Exported files contain personal data. Store them only where your DOS Club role needs them, and delete them when done.</Tip>
        </GuideSection>
      )}

      {sa && (
        <GuideSection id="super" title="Super Admin tasks">
          <Steps
            items={[
              <><strong>Invite an admin:</strong> <Link href="/admin/users">Admin users</Link> → <Kbd>Invite admin</Kbd> → name, email, role → share the one-time password privately. They set up Google Authenticator at first sign-in.</>,
              <><strong>Someone lost their phone and recovery codes:</strong> verify who they are (e.g. by phone call), then <Kbd>Reset 2FA</Kbd> with a reason. They scan a new QR code next time.</>,
              <><strong>Restore deleted students:</strong> <Link href="/recycle-bin">Recycle Bin</Link> → select → <Kbd>Restore</Kbd>. Records deleted more than 30 days ago can be purged for good (type <span className="mono">PURGE</span>).</>,
              <><strong>Who did what:</strong> <Link href="/audit">Audit log</Link>. Filter by person, item type, action or dates, and open <em>before / after</em> to see exact changes.</>,
              <>Viewers can export only if you tick <strong>Export: allowed</strong> for them in Admin users.</>,
            ]}
          />
        </GuideSection>
      )}

      <GuideSection id="help" title="Problems and answers">
        <div className="table-wrap">
          <table className="dtable">
            <thead><tr><th>What you see</th><th>What to do</th></tr></thead>
            <tbody>
              {[
                ["“That code didn't work”", "Check your phone's time is set to automatic, wait for the next code, and try again. Each code works once."],
                ["“Too many attempts. Try again in 15 minutes.”", "Wait 15 minutes, or ask a Super Admin to reset your password."],
                ["Lost phone", "Sign in with a recovery code, then regenerate codes in Account. No codes left: ask a Super Admin to reset your 2FA."],
                ["Upload says the header doesn't match", "Download the template again and paste your data under its header row without renaming columns."],
                ["“Unknown department …” in upload", "Map it to an existing department, or add the department (or an alias) in Masters, then re-check."],
                ["“A student with this email already exists”", "Open the linked student and update it instead of adding a new one."],
                ["Can't delete a master value", "It's used by students. Deactivate it instead."],
                ["Can't retire a skill", "Active roles still require it. Tick “Also remove it from these roles”, or replace it in those roles first."],
                ["Signed out unexpectedly", "Sessions end after 30 idle minutes or 8 hours. Sign in again."],
                ["Student can't do first-time access", "Check their email and mobile in the student master match what they type. If they already activated, use Reset password."],
              ].map(([a, b]) => (
                <tr key={a}><td style={{ fontWeight: 600, minWidth: "14rem" }}>{a}</td><td>{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </GuideSection>

      <GuideSection id="privacy" title="Privacy rules for everyone">
        <ul style={{ paddingLeft: "1.2rem", display: "grid", gap: "0.4rem", lineHeight: 1.55 }}>
          <li>Student data is personal data under India&apos;s DPDP Act 2023. Use it only for DOS Club work.</li>
          <li>Never share screenshots or exports with student details outside your DOS Club role.</li>
          <li>Don&apos;t put student names, emails or phone numbers in chats, URLs or file names.</li>
          <li>Every change, export and sign-in is recorded in the audit log.</li>
          <li>Never share your password, authenticator or recovery codes, not even with another admin.</li>
        </ul>
      </GuideSection>
    </>
  );
}
