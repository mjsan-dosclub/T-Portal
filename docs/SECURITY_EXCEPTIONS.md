# Security exceptions (SEC-10)

`npm audit --omit=dev` must report 0 high/critical advisories, **or** each one must be listed here with a mitigation. Test SEC-10 fails if an advisory appears that isn't listed.

| Package | Severity | Reached via | Why it doesn't affect the running app | Mitigation / exit | Reviewed |
|---|---|---|---|---|---|
| mysql2 | high | `prisma@7.10.0` CLI → MySQL connector | The CLI is only used for migrations, against PostgreSQL. mysql2 is never loaded; it isn't in the Next.js server bundle (runtime uses `@prisma/client` + `@prisma/adapter-pg`). | Re-check on every Prisma upgrade. `npm audit fix` only offers a downgrade to Prisma 6, which is a major regression, so it was not applied. | 2026-10-11 |
| deepmerge-ts | high | `prisma@7.10.0` → `@prisma/config` | Only used when the CLI reads `prisma.config.ts` (trusted, repo-controlled input). Never receives user input. | Same as above. | 2026-10-11 |
| @prisma/config, prisma | high | parents of the above | Same: CLI only. | Same as above. | 2026-10-11 |
