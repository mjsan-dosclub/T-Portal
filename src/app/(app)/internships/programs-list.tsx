"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { EmptyState } from "@/components/states";
import { useToast } from "@/components/toast";
import { EMPTY_PROGRAM, ProgramForm } from "@/components/internship/program-form";
import { MODE_LABEL, PROGRAM_STATUS_LABEL } from "@/lib/validation/internship";

type Program = {
  id: string; code: string; companyName: string; title: string; country: string; city: string | null; workMode: string; status: string;
  seats: number; assigned: number; weeks: number; durationValue: number; durationUnit: string; startDate: string | null; endDate: string | null; compliance: number | null; pendingReviews: number;
};

export const STATUS_TONE: Record<string, string> = { DRAFT: "tone-muted", OPEN: "tone-accent", ONGOING: "tone-primary", COMPLETED: "tone-deep", CANCELLED: "tone-muted" };

export function ProgramsList({ programs, editable }: { programs: Program[]; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const shown = filter ? programs.filter((p) => p.status === filter) : programs;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1rem" }}>
      <section className="glass card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end", padding: "1rem 1.25rem" }}>
        <div className="field" style={{ flex: "0 1 14rem" }}>
          <label className="label" htmlFor="int-filter">Status</label>
          <select id="int-filter" className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All programs</option>
            {Object.entries(PROGRAM_STATUS_LABEL).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>+ New program</button>}
      </section>

      {shown.length === 0 ? (
        <EmptyState title={programs.length ? "No programs with this status" : "No internship programs yet"} body={editable ? "Add the client's internship: company, description, number of resources and duration." : undefined} />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(19rem, 1fr))", gap: "0.8rem" }} data-testid="program-list">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/internships/${p.id}`} className="glass-strong card" style={{ display: "grid", gap: "0.5rem", textDecoration: "none", color: "var(--text)", height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span className="chip mono">{p.code}</span>
                  <span className={`chip ${STATUS_TONE[p.status]}`}>{PROGRAM_STATUS_LABEL[p.status as keyof typeof PROGRAM_STATUS_LABEL]}</span>
                </div>
                <div>
                  <div className="display" style={{ fontWeight: 600, fontSize: "1.05rem" }}>{p.title}</div>
                  <div className="hint">{p.companyName} · {[p.city, p.country].filter(Boolean).join(", ")} · {MODE_LABEL[p.workMode as keyof typeof MODE_LABEL]}</div>
                </div>
                <div className="hint">
                  {p.durationValue} {p.durationUnit === "WEEKS" ? "week(s)" : "day(s)"} · {p.weeks} weekly report(s){p.startDate ? ` · ${p.startDate} → ${p.endDate}` : " · start date not set"}
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span className="chip tone-primary">{p.assigned} / {p.seats} assigned</span>
                  {p.compliance !== null && <span className="chip tone-accent">{p.compliance}% reports in</span>}
                  {p.pendingReviews > 0 && <span className="chip tone-deep">{p.pendingReviews} to review</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <Modal open wide onOpenChange={(o) => !o && setCreating(false)} title="New internship program" description="Basic information from the client. You'll assign students next.">
          <ProgramForm
            initial={EMPTY_PROGRAM}
            onCancel={() => setCreating(false)}
            onDone={(id) => {
              toast({ message: "Program created" });
              router.push(`/internships/${id}`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
