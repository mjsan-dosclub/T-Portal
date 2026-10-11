import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { getProgram } from "@/server/internships";
import { HttpError } from "@/server/http";
import { PageHeader } from "../../page-header";
import { ProgramDetailView } from "./program-detail";

export const metadata = { title: "Internship program" };

export default async function ProgramPage({ params }: PageProps<"/internships/[id]">) {
  const admin = await requirePageAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const data = await getProgram(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title={data.program.title} subtitle={<><Link href="/internships">Internships</Link> · {data.program.code} · {data.program.companyName}</>} />
      <ProgramDetailView data={data} editable={canEdit(admin)} />
    </>
  );
}
