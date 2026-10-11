"use client";

import { downloadPost } from "@/components/api";
import { useToast } from "@/components/toast";

export function ExportReady({ filter }: { filter: { batchId?: string; institutionId?: string; roleId?: string; level?: "ready" | "nearly" } }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={async () => {
        const err = await downloadPost("/api/insights/ready-export", filter, "ready-for-role.csv");
        toast({ message: err ?? "Exported" });
      }}
    >
      Export CSV
    </button>
  );
}
