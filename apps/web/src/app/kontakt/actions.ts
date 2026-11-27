"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ContactState = { ok?: boolean; error?: string; values?: Record<string, string> };

const TOPICS = new Set(["remeslnik", "zakaznik", "predplatne", "jine"]);

/**
 * Kontaktní formulář. Proti robotům: skryté pole „web“ musí zůstat prázdné a formulář nesmí být
 * odeslaný dřív než 3 s po zobrazení. IP adresu neukládáme – jen její otisk kvůli limitu zpráv.
 */
export async function sendContact(_: ContactState, form: FormData): Promise<ContactState> {
  const values = {
    name: String(form.get("name") ?? "").trim().slice(0, 100),
    email: String(form.get("email") ?? "").trim().slice(0, 254),
    topic: String(form.get("topic") ?? "jine"),
    message: String(form.get("message") ?? "").trim().slice(0, 4000),
  };
  const started = Number(form.get("t") ?? 0);
  if (String(form.get("web") ?? "") !== "" || !started || Date.now() - started < 3000) {
    return { ok: true }; // robot: tváříme se, že je odesláno
  }
  if (values.name.length < 2) return { error: "Vyplňte prosím jméno.", values };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) return { error: "Zkontrolujte e-mail – na něj vám odpovíme.", values };
  if (!TOPICS.has(values.topic)) values.topic = "jine";
  if (values.message.length < 10) return { error: "Napište prosím, s čím vám můžeme pomoct (aspoň pár slov).", values };
  if (form.get("consent") !== "on") return { error: "Potvrďte prosím souhlas se zpracováním údajů kvůli odpovědi.", values };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const ipHash = ip ? createHash("sha256").update(`iremeslo-contact:${ip}`).digest("hex") : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_contact_message", {
    p_name: values.name, p_email: values.email, p_topic: values.topic, p_message: values.message, p_ip_hash: ipHash,
  });
  if (error) {
    if (error.message.includes("příliš mnoho")) return { error: "Poslali jste už několik zpráv – odpovíme na ně. Další zkuste prosím za hodinu.", values };
    return { error: "Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.", values };
  }
  return { ok: true };
}
