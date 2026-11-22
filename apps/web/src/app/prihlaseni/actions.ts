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

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (form.get("terms") !== "on") return { error: "Pro registraci je potřeba souhlasit s podmínkami." };
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${site}/auth/confirm?next=/registrace-firmy` },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "Tento e-mail už je registrovaný. Přihlaste se." };
    return { error: "Registrace se nepovedla. Zkuste to prosím znovu." };
  }
  if (data.session) redirect("/registrace-firmy");
  return { info: "Hotovo! Poslali jsme vám e-mail s odkazem pro potvrzení. Po kliknutí na něj založíte firmu." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
