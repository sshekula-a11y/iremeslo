/** Firma načtená z ARES (odpověď /api/ares/[ico]). */
export interface AresCompany {
  ico: string;
  name: string;
  dic: string | null;
  street: string;
  city: string;
  zip: string;
  vatPayer: boolean;
}
