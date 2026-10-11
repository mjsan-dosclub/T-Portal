import { getRole } from "@/server/ontology/queries";
import { ALL_ROLES, HttpError, json, withAuth } from "@/server/http";

export const GET = withAuth<{ id: string }>(ALL_ROLES, async (_ctx, p) => {
  const role = await getRole(p.id);
  if (!role) throw new HttpError(404, "Role not found");
  return json(role);
});
