import { MASTER_TYPES, type MasterType } from "@/lib/validation/masters";
import { readUploadedFile } from "@/server/upload/form-file";
import { importMasters } from "@/server/upload/masters-import";
import { EDITORS, HttpError, json, withAuth } from "@/server/http";

export const POST = withAuth<{ type: string }>(EDITORS, async (ctx, p) => {
  if (!(MASTER_TYPES as readonly string[]).includes(p.type)) throw new HttpError(404, "Unknown master");
  const file = await readUploadedFile(ctx.req);
  const dryRun = file.form.get("dryRun") !== "false";
  return json(await importMasters(p.type as MasterType, file, dryRun, ctx.admin, ctx));
});
