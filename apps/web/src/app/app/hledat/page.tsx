import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { czk, formatDate } from "@/lib/format";
import { DOC_TYPE_LABELS } from "@/lib/documents/load";

export const metadata: Metadata = { title: "Hledat" };

const clean = (s: string) => s.replace(/[%_,()"\\*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

/** Hledání napříč firmou: zákazníci, zakázky, doklady a výdaje. */
export default async function SearchPage({ searchParams }: PageProps<"/app/hledat">) {
  const company = await requireStaff();
  const raw = (await searchParams).q;
  const q = clean(typeof raw === "string" ? raw : "");
  const supabase = await createClient();
  const like = `*${q}*`;

  const [clients, jobs, docs, expenses] = q.length < 2 ? [null, null, null, null] : await Promise.all([
    supabase.from("clients").select("id, name, ico, city, phone, email").eq("company_id", company.id)
      .or(`name.ilike.${like},ico.ilike.${like},email.ilike.${like},phone.ilike.${like},city.ilike.${like}`).order("name").limit(20),
    supabase.from("jobs").select("id, number, title, status").eq("company_id", company.id)
      .or(`title.ilike.${like},number.ilike.${like}`).order("created_at", { ascending: false }).limit(20),
    supabase.from("documents").select("id, type, number, issue_date, total_due, customer:snapshot->customer->>name").eq("company_id", company.id)
      .not("number", "is", null).or(`number.ilike.${like},snapshot->customer->>name.ilike.${like}`).order("issue_date", { ascending: false }).limit(30),
    supabase.from("expenses").select("id, supplier_name, issue_date, total, description").eq("company_id", company.id)
      .or(`supplier_name.ilike.${like},description.ilike.${like},doc_number.ilike.${like}`).order("issue_date", { ascending: false }).limit(20),
  ]);
  const total = (clients?.data?.length ?? 0) + (jobs?.data?.length ?? 0) + (docs?.data?.length ?? 0) + (expenses?.data?.length ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-[24px] font-extrabold">Hledat</h1>
      <form role="search" action="/app/hledat" className="flex gap-2">
        <label className="sr-only" htmlFor="q">Co hledáte</label>
        <input id="q" name="q" type="search" defaultValue={q} autoFocus placeholder="Zákazník, IČO, telefon, číslo dokladu, zakázka…" className="field flex-1" />
        <button className="btn-primary">Hledat</button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="text-muted">Napište aspoň 2 znaky.</p>}
      {q.length >= 2 && total === 0 && <p className="card p-6 text-center text-muted">Pro „{q}“ jsme nic nenašli.</p>}

      <Section title="Zákazníci" count={clients?.data?.length ?? 0}>
        {clients?.data?.map((c) => <Row key={c.id} href="/app/zakaznici" title={c.name} sub={[c.ico && `IČO ${c.ico}`, c.city, c.phone, c.email].filter(Boolean).join(" · ")} />)}
      </Section>
      <Section title="Zakázky" count={jobs?.data?.length ?? 0}>
        {jobs?.data?.map((j) => <Row key={j.id} href={`/app/zakazky/${j.id}`} title={<><span className="num">{j.number}</span> · {j.title}</>} />)}
      </Section>
      <Section title="Doklady" count={docs?.data?.length ?? 0}>
        {(docs?.data as unknown as { id: string; type: string; number: string; issue_date: string; total_due: string; customer: string | null }[] | null)?.map((d) => (
          <Row key={d.id} href={`/app/doklady/${d.id}`} title={<>{DOC_TYPE_LABELS[d.type] ?? d.type} <span className="num">{d.number}</span></>}
            sub={[formatDate(d.issue_date), d.customer].filter(Boolean).join(" · ")} right={Number(d.total_due) ? czk(d.total_due) : undefined} />
        ))}
      </Section>
      <Section title="Výdaje" count={expenses?.data?.length ?? 0}>
        {expenses?.data?.map((e) => <Row key={e.id} href={`/app/vydaje/${e.id}`} title={e.supplier_name} sub={[formatDate(e.issue_date), e.description].filter(Boolean).join(" · ")} right={czk(e.total)} />)}
      </Section>
    </div>
  );
}

function Section({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  return count === 0 ? null : (
      <section className="card" aria-label={title}>
        <h2 className="border-b border-line px-4 py-2.5 text-[14px] font-semibold text-muted">{title} <span className="num">({count})</span></h2>
        <ul className="divide-y divide-line">{children}</ul>
      </section>
    );
}

function Row({ href, title, sub, right }: { href: string; title: React.ReactNode; sub?: string; right?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper">
        <span className="min-w-0"><span className="block truncate font-semibold">{title}</span>{sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}</span>
        {right && <span className="num shrink-0 font-semibold">{right}</span>}
      </Link>
    </li>
  );
}
