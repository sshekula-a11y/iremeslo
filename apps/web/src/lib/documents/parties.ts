import "server-only";
import type { Party, PaymentInfo } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";

export interface Parties {
  supplier: Party;
  customer: Party | null;
  vatPayer: boolean;
  payment: PaymentInfo | null;
  paymentTermsDays: number;
}

/** Dodavatel (firma), odběratel (klient) a účet – tak, jak se zamrazí do vystaveného dokladu. */
export async function loadParties(companyId: string, clientId: string | null): Promise<Parties> {
  const supabase = await createClient();
  const [{ data: firm }, { data: client }] = await Promise.all([
    supabase
      .from("companies")
      .select("name, ico, dic, street, city, zip, email, phone, web, register_entry, vat_payer, bank_account, iban, bic, payment_terms_days")
      .eq("id", companyId)
      .single(),
    clientId
      ? supabase.from("clients").select("name, ico, dic, street, city, zip, email, phone").eq("company_id", companyId).eq("id", clientId).single()
      : Promise.resolve({ data: null }),
  ]);
  if (!firm) throw new Error("Nepodařilo se načíst údaje firmy.");
  return {
    supplier: {
      name: firm.name, ico: firm.ico, dic: firm.dic, street: firm.street, city: firm.city, zip: firm.zip,
      email: firm.email, phone: firm.phone, web: firm.web, registerEntry: firm.register_entry,
    },
    customer: client
      ? { name: client.name, ico: client.ico, dic: client.dic, street: client.street, city: client.city, zip: client.zip, email: client.email, phone: client.phone }
      : null,
    vatPayer: firm.vat_payer,
    payment: firm.iban || firm.bank_account ? { bankAccount: firm.bank_account, iban: firm.iban, bic: firm.bic } : null,
    paymentTermsDays: firm.payment_terms_days,
  };
}
