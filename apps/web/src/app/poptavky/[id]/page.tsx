import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABEL, formatQuantity, formatTerm, timeAgo, type InquiryContact, type PublicInquiry } from "@/lib/inquiries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string): Promise<PublicInquiry | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_inquiry", { p_id: id });
  return (data as PublicInquiry | null) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/poptavky/[id]">): Promise<Metadata> {
  const q = await load((await params).id);
  if (!q) return { title: "Poptávka nenalezena" };
  return { title: `${q.title} – ${q.city}`, description: q.description.slice(0, 160) };
}

/** Detail poptávky. Kontakt se načte jen po kliknutí přihlášeného uživatele s potvrzeným e-mailem (?kontakt=1). */
export default async function InquiryPage({ params, searchParams }: PageProps<"/poptavky/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  let q = await load(id);
  if (!q) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const loggedIn = !!auth?.claims?.sub;
  const active = q.status === "open";
  const { data: emailStatus } = loggedIn ? await supabase.rpc("my_email_status") : { data: null };
  const verified = (emailStatus as { verified?: boolean } | null)?.verified !== false;

  let contact: InquiryContact | null = null;
  let contactError: string | null = null;
  if (active && loggedIn && verified && sp.kontakt === "1") {
    const { data, error } = await supabase.rpc("inquiry_contact", { p_id: id });
    if (error) contactError = error.message.includes("50 kontaktů")
      ? "Dnes jste zobrazili už 50 kontaktů. Další uvidíte zítra."
      : "Kontakt se nepodařilo načíst. Zkuste to prosím znovu.";
    else {
      contact = data as InquiryContact;
      q = (await load(id)) ?? q; // počítadlo zobrazení už zahrnuje i toto
    }
  }

  const qty = formatQuantity(q.quantity, q.unit);
  const back = `/poptavky/${id}`;

  return (
    <main>
      <SiteHeader current="poptavky" />
      <div className="mx-auto max-w-3xl space-y-5 px-5 py-8">
        <Link href="/poptavky" className="text-[14px] text-muted hover:text-ink">← Všechny poptávky</Link>

        <article className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span className="rounded-full bg-paper px-2 py-0.5 font-semibold text-ink">{CATEGORY_LABEL[q.category] ?? q.category}</span>
            <span>zadáno {timeAgo(q.created_at)}</span>
            {!active && <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">{q.status === "closed" ? "Uzavřeno" : "Platnost skončila"}</span>}
          </div>
          <h1 className="mt-2 font-display text-[26px] font-extrabold leading-tight sm:text-[30px]">{q.title}</h1>

          <dl className="mt-4 grid gap-3 rounded-xl bg-paper p-4 text-[15px] sm:grid-cols-3">
            {qty && <div><dt className="text-[13px] text-muted">Rozsah</dt><dd className="num font-semibold">{qty}</dd></div>}
            <div><dt className="text-[13px] text-muted">Místo</dt><dd className="font-semibold">{q.city}{q.zip ? `, ${q.zip}` : ""}</dd></div>
            <div><dt className="text-[13px] text-muted">Termín</dt><dd className="font-semibold">{formatTerm(q.term, q.term_date, q.term_from)}</dd></div>
          </dl>

          <h2 className="mt-5 font-display text-[17px] font-bold">Popis</h2>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{q.description}</p>
          {active && <p className="mt-4 text-[13px] text-muted">Poptávka platí do {formatDate(q.expires_at.slice(0, 10))}.</p>}
        </article>

        {active && (
          <section className="card p-5 sm:p-6" aria-labelledby="kontakt">
            <h2 id="kontakt" className="font-display text-[20px] font-extrabold">Kontakt na zadavatele</h2>
            {contact ? (
              <dl className="mt-3 space-y-2 text-[16px]">
                <div><dt className="text-[13px] text-muted">Jméno</dt><dd className="font-semibold">{contact.name}</dd></div>
                {contact.phone && <div><dt className="text-[13px] text-muted">Telefon</dt><dd><a className="num font-semibold text-accent-ink underline" href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a></dd></div>}
                <div><dt className="text-[13px] text-muted">E-mail</dt><dd><a className="break-all font-semibold text-accent-ink underline" href={`mailto:${contact.email}?subject=${encodeURIComponent(`Poptávka: ${q.title}`)}`}>{contact.email}</a></dd></div>
                {contact.street && <div><dt className="text-[13px] text-muted">Adresa</dt><dd>{contact.street}, {contact.city}{contact.zip ? `, ${contact.zip}` : ""}</dd></div>}
                <p className="pt-2 text-[13px] text-muted">Kontakt použijte jen k odpovědi na tuto poptávku.</p>
              </dl>
            ) : !loggedIn ? (
              <div className="mt-2">
                <p className="text-[15px] text-muted">Jméno, telefon, e-mail a přesnou adresu vidí jen registrovaní řemeslníci. Registrace je zdarma.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/prihlaseni?next=${encodeURIComponent(back + "?kontakt=1")}`} className="btn-dark">Přihlásit se</Link>
                  <Link href={`/prihlaseni?rezim=registrace&next=${encodeURIComponent(back)}`} className="btn-ghost">Registrovat se zdarma</Link>
                </div>
              </div>
            ) : !verified ? (
              <p className="mt-2 text-[15px] text-muted">
                Kontakt se zobrazí po potvrzení vašeho e-mailu. Odkaz jsme vám poslali při registraci; nový si pošlete v <Link href="/app" className="font-semibold text-accent-ink underline">aplikaci</Link>.
              </p>
            ) : (
              <div className="mt-2">
                {contactError && <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn" role="alert">{contactError}</p>}
                <Link href={`${back}?kontakt=1`} className="btn-primary" rel="nofollow">Zobrazit kontakt</Link>
                <p className="mt-2 text-[13px] text-muted">Zadavatel uvidí, kolik řemeslníků si kontakt zobrazilo.</p>
              </div>
            )}
            {q.views > 0 && <p className="mt-4 border-t border-line pt-3 text-[13px] text-muted">Kontakt si zobrazil{q.views === 1 ? " 1 řemeslník" : q.views < 5 ? `i ${q.views} řemeslníci` : "o " + q.views + " řemeslníků"}.</p>}
          </section>
        )}

        <aside className="card flex flex-wrap items-center justify-between gap-3 border-dashed p-5">
          <p className="text-[15px]"><strong>Také hledáte řemeslníka?</strong> Poptávku zadáte zdarma a bez registrace.</p>
          <Link href="/poptavky/nova" className="btn-ghost">Zadat poptávku</Link>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}
