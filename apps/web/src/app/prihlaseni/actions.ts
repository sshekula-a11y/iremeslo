"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/legal";

export type AuthState = { error?: string; info?: string; noAccount?: boolean };

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
});

function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/app";
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Nejprve potvrďte e-mail – odkaz jsme vám poslali." };
    // E-mail bez účtu: formulář se sám přepne na registraci (migrace 009).
    const { data: registered } = await supabase.rpc("email_registered", { p_email: parsed.data.email });
    if (registered === false) return { noAccount: true };
    return { error: "Nesprávné heslo. Zkuste ho prosím zadat znovu." };
  }
  redirect(safeNext(form.get("next")));
}

/**
 * Registrace bez potvrzovacího e-mailu: účet založí databáze (signup_with_password, migrace 008)
 * a člověka hned přihlásíme. Nezávisí tak na nastavení e-mailů v administraci Supabase.
 */
export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.password.length > 72) return { error: "Heslo může mít nejvýše 72 znaků." };
  if (form.get("terms") !== "on") return { error: "Pro registraci je potřeba souhlasit s podmínkami." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("signup_with_password", { p_email: parsed.data.email, p_password: parsed.data.password });
  if (error) {
    if (error.message.includes("už je registrovaný")) return { error: "Tento e-mail už je registrovaný. Přihlaste se." };
    if (error.message.includes("příliš mnoho")) return { error: "Právě je o registraci velký zájem. Zkuste to prosím za několik minut." };
    if (error.message.includes("e-mail")) return { error: "Zadejte platný e-mail." };
    return { error: "Registrace se nezdařila. Zkuste to prosím znovu." };
  }

  const { error: loginError } = await supabase.auth.signInWithPassword(parsed.data);
  if (loginError) return { error: "Účet byl vytvořen, ale přihlášení se nezdařilo. Přihlaste se prosím." };
  // Doklad o souhlasu s obchodními podmínkami (verze a čas) – § 1753 OZ, archivace smlouvy (VOP čl. 2).
  await supabase.auth.updateUser({ data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() } });
  // Gratulace a další kroky jsou na stránce zadání IČO.
  redirect("/registrace-firmy?vitejte=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
