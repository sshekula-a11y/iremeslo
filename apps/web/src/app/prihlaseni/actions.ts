"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/legal";
import { inquiryReturn, safeNext } from "@/lib/safe-next";

export type AuthState = { error?: string; info?: string; noAccount?: boolean };

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
});

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Nejprve potvrďte e-mail – odkaz jsme vám poslali." };
    // Neříkáme, jestli účet existuje (jinak by šlo zjišťovat registrované e-maily) – formulář nabídne registraci.
    return { error: "Nesprávný e-mail nebo heslo.", noAccount: true };
  }
  redirect(safeNext(form.get("next")));
}

/**
 * Dokončení registrace. Účet založí databáze (signup_with_password) – volá ji formulář přímo z prohlížeče,
 * aby limit registrací platil pro adresu návštěvníka, ne pro sdílenou adresu serveru (migrace 033).
 * Tady člověka přihlásíme a uložíme souhlas s podmínkami.
 */
export async function completeSignUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (form.get("terms") !== "on") return { error: "Pro registraci je potřeba souhlasit s podmínkami." };
  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword(parsed.data);
  if (loginError) return { error: "Účet byl vytvořen, ale přihlášení se nezdařilo. Přihlaste se prosím." };
  // Doklad o souhlasu s obchodními podmínkami (verze a čas) – § 1753 OZ, archivace smlouvy (VOP čl. 2).
  await supabase.auth.updateUser({ data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() } });
  // Gratulace a další kroky jsou na stránce zadání IČO.
  // Řemeslník, který přišel z poptávky, se po zadání IČO vrátí zpět k ní.
  const back = inquiryReturn(form.get("next"));
  redirect(back ? `/registrace-firmy?vitejte=1&next=${encodeURIComponent(back)}` : "/registrace-firmy?vitejte=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
