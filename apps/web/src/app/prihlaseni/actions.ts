"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail"),
  password: z.string().min(8, "Heslo musí mít aspoň 8 znaků"),
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
    if (error.code === "email_not_confirmed") return { error: "Nejdřív potvrďte e-mail – odkaz jsme vám poslali." };
    return { error: "Špatný e-mail nebo heslo." };
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
  if (parsed.data.password.length > 72) return { error: "Heslo může mít nejvýš 72 znaků." };
  if (form.get("terms") !== "on") return { error: "Pro registraci je potřeba souhlasit s podmínkami." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("signup_with_password", { p_email: parsed.data.email, p_password: parsed.data.password });
  if (error) {
    if (error.message.includes("už je registrovaný")) return { error: "Tento e-mail už je registrovaný. Přihlaste se." };
    if (error.message.includes("příliš mnoho")) return { error: "Právě se registruje hodně lidí. Zkuste to prosím za pár minut." };
    if (error.message.includes("e-mail")) return { error: "Zadejte platný e-mail." };
    return { error: "Registrace se nepovedla. Zkuste to prosím znovu." };
  }

  const { error: loginError } = await supabase.auth.signInWithPassword(parsed.data);
  if (loginError) return { error: "Účet je založený, ale přihlášení se nepovedlo. Přihlaste se prosím." };
  // Gratulace a další kroky jsou na stránce zadání IČO.
  redirect("/registrace-firmy?vitejte=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
