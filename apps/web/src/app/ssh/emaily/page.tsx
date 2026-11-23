import type { Metadata } from "next";
import { adminDate, requireAdmin } from "@/lib/admin";
import { ActionForm } from "../ActionForm";
import { saveEmailSettings, sendTestEmail, verifyUserEmail } from "../actions";

export const metadata: Metadata = { title: "E-maily" };

interface EmailSettings {
  has_key: boolean;
  key_hint: string | null;
  site_url: string;
  mail_from: string;
  unverified_count: number;
  unverified: { user_id: string; email: string; created_at: string; has_company: boolean }[];
  log: { id: number; to: string; kind: string; created_at: string; error: string | null; status: number | null; response: string | null }[];
}

const KIND: Record<string, string> = { overeni: "Potvrzení e-mailu", test: "Zkušební" };

export default async function AdminEmails() {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_email_settings");
  if (error || !data) throw new Error("Nastavení e-mailů se nepodařilo načíst.");
  const s = data as EmailSettings;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">E-maily</h1>
        <p className="mt-1 text-[14px] text-muted">Potvrzovací e-maily posílá Resend z adresy {s.mail_from}.</p>
      </div>

      <div className={`rounded-2xl px-4 py-3 text-[14px] ${s.has_key ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`} role="status">
        {s.has_key
          ? <>Odesílání je zapnuté (klíč <span className="num">{s.key_hint}</span>).</>
          : <><strong>Odesílání je vypnuté</strong> – chybí klíč Resend. Registrace funguje, ale potvrzovací e-maily se neodesílají.</>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="nastaveni">
          <h2 id="nastaveni" className="font-display text-[17px] font-bold">Nastavení</h2>
          <ActionForm action={saveEmailSettings} submit="Uložit" tone="primary" className="mt-3">
            <div>
              <label className="label" htmlFor="api_key">API klíč Resend {s.has_key && "(nový – jinak nechte prázdné)"}</label>
              <input className="field num" id="api_key" name="api_key" type="password" autoComplete="off" placeholder="re_…" spellCheck={false} />
              <p className="mt-1 text-[13px] text-muted">Uloží se do trezoru Supabase Vault. Zpátky se už nikde nezobrazí.</p>
            </div>
            <div>
              <label className="label" htmlFor="mail_from">Odesílatel</label>
              <input className="field" id="mail_from" name="mail_from" defaultValue={s.mail_from} />
            </div>
            <div>
              <label className="label" htmlFor="site_url">Adresa webu (do odkazů v e-mailech)</label>
              <input className="field" id="site_url" name="site_url" defaultValue={s.site_url} />
            </div>
          </ActionForm>
        </section>

        <section className="card p-4" aria-labelledby="test">
          <h2 id="test" className="font-display text-[17px] font-bold">Zkušební e-mail</h2>
          <p className="mt-1 text-[13px] text-muted">Pošle krátký e-mail s logem. Zkontrolujte, že nepadl do spamu.</p>
          <ActionForm action={sendTestEmail} submit="Poslat zkušební e-mail" className="mt-3">
            <div>
              <label className="label" htmlFor="to">Komu</label>
              <input className="field" id="to" name="to" type="email" defaultValue={user.email ?? ""} />
            </div>
          </ActionForm>
        </section>
      </div>

      <section className="card" aria-labelledby="log">
        <h2 id="log" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Odeslané e-maily</h2>
        {s.log.length ? (
          <ul className="divide-y divide-line text-[14px]">
            {s.log.map((l) => {
              const ok = !l.error && l.status !== null && l.status >= 200 && l.status < 300;
              const waiting = !l.error && l.status === null;
              return (
                <li key={l.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><span className="break-all font-semibold">{l.to}</span> <span className="text-muted">· {KIND[l.kind] ?? l.kind} · {adminDate(l.created_at, true)}</span></span>
                    <span className={`text-[13px] font-semibold ${ok ? "text-ok" : waiting ? "text-muted" : "text-warn"}`}>
                      {ok ? "doručeno do Resend" : waiting ? "odesílá se / bez odpovědi" : `chyba${l.status ? ` ${l.status}` : ""}`}
                    </span>
                  </div>
                  {!ok && (l.error || l.response) && <p className="mt-1 break-all text-[13px] text-muted">{l.error ?? l.response}</p>}
                </li>
              );
            })}
          </ul>
        ) : <p className="px-4 py-6 text-center text-muted">Zatím nic neodešlo.</p>}
      </section>

      <section className="card" aria-labelledby="nepotvrzene">
        <h2 id="nepotvrzene" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">
          Nepotvrzené e-maily <span className="num text-muted">({s.unverified_count})</span>
        </h2>
        <p className="px-4 pt-3 text-[13px] text-muted">Bez potvrzení nejde vystavit fakturu. Účty bez firmy se po 7 dnech samy smažou.</p>
        {s.unverified.length ? (
          <ul className="divide-y divide-line text-[14px]">
            {s.unverified.map((u) => (
              <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span><span className="break-all font-semibold">{u.email}</span> <span className="text-muted">· {adminDate(u.created_at, true)}{u.has_company ? " · má firmu" : " · bez firmy"}</span></span>
                <ActionForm action={verifyUserEmail} submit="Potvrdit ručně" tone="ghost">
                  <input type="hidden" name="user" value={u.user_id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : <p className="px-4 py-6 text-center text-muted">Všichni mají e-mail potvrzený.</p>}
      </section>
    </div>
  );
}
