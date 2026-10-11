"use client";

import dynamic from "next/dynamic";
import { SkeletonRows } from "@/components/states";

// Client-only: the table restores filters from sessionStorage on first render, which the server can't see.
export const StudentsTableClient = dynamic(() => import("./students-table").then((m) => m.StudentsTable), {
  ssr: false,
  loading: () => <SkeletonRows rows={8} cols={7} />,
});
