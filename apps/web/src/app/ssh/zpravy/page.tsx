import type { Metadata } from "next";
import { adminDate, requireAdmin } from "@/lib/admin";
import { ActionForm } from "../ActionForm";
import { setContactHandled } from "../actions";

export const metadata: Metadata = { title: "Zprávy z kontaktu" };

interface Msg { id: number; created_at: string; name: string; email: string; topic: string; message: string; handled_at: string | null }

const TOPIC: Record<string, string> = {
  remeslnik: "Řemeslník – aplikace", zakaznik: "Zákazník – poptávka", predplatne: "Předplatné a fakturace", jine: "Jiné",
};

export default async function AdminMessages() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_contact_messages");
  if (error) throw new Error("Zprávy se nepodařilo načíst.");
  const list = (data ?? []) as Msg[];
  const open = list.filter((m) => !m.handled_at);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Zprávy z kontaktního formuláře</h1>
        <p className="mt-1 text-[14px] text-muted">
          Každá zpráva přijde i e-mailem – odpovědí na něj odpovíte přímo odesílateli. {open.length ? `Nevyřízené: ${open.length}.` : "Vše vyřízeno."}
        </p>
      </div>
      {list.length === 0 ? (
        <p className="card p-5 text-[15px] text-muted">Zatím žádné zprávy.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((m) => (
            <li key={m.id} className={`card p-4 ${m.handled_at ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{m.name} <span className="font-normal text-muted">· {m.email}</span></p>
                <p className="text-[13px] text-muted">{adminDate(m.created_at, true)} · {TOPIC[m.topic] ?? m.topic}</p>
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-[15px]">{m.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a className="btn-ghost min-h-10" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: dotaz na iRemeslo.cz")}`}>Odpovědět</a>
                <ActionForm action={setContactHandled} submit={m.handled_at ? "Vrátit mezi nevyřízené" : "Označit jako vyřízené"} tone="ghost">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="handled" value={m.handled_at ? "false" : "true"} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
