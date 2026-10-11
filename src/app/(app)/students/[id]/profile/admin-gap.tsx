"use client";

import { useRouter } from "next/navigation";
import { GapTable } from "@/components/skills/gap-table";
import type { Profile } from "@/server/profile";

export function AdminGap({ profile, editable }: { profile: Profile; editable: boolean }) {
  const router = useRouter();
  return <GapTable key={JSON.stringify(profile.ratings)} profile={profile} mode={editable ? "admin" : "view"} saveUrl={`/api/students/${profile.student.id}/skills`} onSaved={() => router.refresh()} />;
}
