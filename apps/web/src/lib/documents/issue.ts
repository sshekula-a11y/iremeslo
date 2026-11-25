import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInPrague } from "@/lib/calendar";
import type { ActiveCompany } from "@/lib/data";

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export async function currentUser() {
  const supabase = await createClient();
  return (await supabase.auth.getClaims()).data?.claims?.sub ?? null;
}

/**
 * Založí koncept a hned ho vystaví funkcí issue_document (číslo z řady, data, zámek).
 * Když vystavení selže, koncept se smaže, ať v seznamu nestraší.
 */
export async function insertAndIssue(
  company: ActiveCompany,
  row: Record<string, unknown>,
  afterInsert?: (id: string) => Promise<string | null>,
): Promise<CreateResult> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({ company_id: company.id, created_by: await currentUser(), ...row })
    .select("id")
    .single();
  if (error || !doc) return { ok: false, error: "Doklad se nepodařilo uložit." };

  const fail = async (text: string): Promise<CreateResult> => {
    await supabase.from("documents").delete().eq("company_id", company.id).eq("id", doc.id);
    return { ok: false, error: text };
  };
  if (afterInsert) {
    const err = await afterInsert(doc.id);
    if (err) return fail(err);
  }
  const { error: issueError } = await supabase.rpc("issue_document", { p_document: doc.id, p_issue_date: todayInPrague() });
  if (issueError) {
    if (issueError.message.includes("potvrďte svůj e-mail")) {
      return fail("Fakturu vystavíte po potvrzení e-mailu. Klikněte na odkaz, který jsme vám poslali (nahoře můžete poslat nový).");
    }
    return fail("Doklad se nepodařilo vystavit: " + issueError.message);
  }
  return { ok: true, id: doc.id };
}

