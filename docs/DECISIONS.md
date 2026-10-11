# Decisions log (append-only)

Open questions are listed in PRD §12 (D1–D14). Record each answer here when it is given. Never edit or delete past rows; to change a decision, add a new row that says it supersedes the earlier one.

| Date | ID | Question | Decision | By |
|---|---|---|---|---|
| 2026-10-11 | V-01 | Ontology counts | Verified by script: 11 / **51** / 165 / 103 / 103 / 6 / 27. Replaces "45 subcategories" in PRD v1.0. See FACTS F1. | Verified (script) |
| 2026-10-11 | V-02 | Website fonts | Verified from site CSS: Space Grotesk (display), system-UI sans (body), JetBrains Mono (mono). D2 still open: match the site or use Inter for body? | Verified (site CSS) |
| 2026-10-11 | V-03 | Brand colours | Verified site tokens (FACTS F3) replace the logo estimates. White text on the gradient fails WCAG, so the primary button is solid #0D6B90. D3 still open for danger/warning hues. | Verified (site CSS) |
| 2026-10-11 | D11 | SFIA 9 licence | Learning project. Each student registers with SFIA and downloads their own individual licence. The portal shows a licence notice on ontology pages. | PM (chat) |
| 2026-10-11 | GO | Start build | PM said "proceed to develop the tool". Claude takes the PRD recommendations for D1–D7, D10, D12–D14 as **defaults the PM can override**: D1 email+password+TOTP · D2 match the site fonts · D3 site tokens; danger/warning hues pending · D4 colour teams yes (optional) · D5 target role only · D6 30-day manual purge · D7 Next.js + Postgres + Prisma · D10 no existing ID, use DOS-YYYY-NNNNN · D12 export for Super Admin + Admin · D13 YYYY = batch year · D14 Mumbai region at deploy | PM (chat) → Claude defaults |
| 2026-10-11 | D8/D9 | Consent source / membership sync | Learning project: **fake data only** (`@example.test`). Real member data must not be imported until D8 is answered. | PM (chat) → Claude default |
| 2026-10-11 | ENV-1 | Local DB | The Mac has no Postgres or Docker and little free disk, so dev and test use the `embedded-postgres` npm package (project-local, removable). Production would use managed Postgres. | Claude (env constraint) |
