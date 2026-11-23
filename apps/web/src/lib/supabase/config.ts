/**
 * Databáze iRemeslo (Supabase, projekt „iremeslo“, Frankfurt).
 *
 * Adresa a publishable key jsou záměrně přímo v kódu: oba jsou veřejné (posílají se do každého
 * prohlížeče) a web tak nezávisí na nastavení proměnných ve Vercelu. Přístup k datům hlídá RLS v databázi.
 * Tajný klíč (service role / secret) sem NIKDY nepatří.
 *
 * Pro lokální vývoj proti jiné databázi jde hodnoty přepsat proměnnými NEXT_PUBLIC_IREMESLO_SUPABASE_URL / _KEY.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_IREMESLO_SUPABASE_URL || "https://pisrgrqbspayqdkdeuwg.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_IREMESLO_SUPABASE_KEY || "sb_publishable_Z4ciqoeBJSm863A7QtZIAw_qOmfmG2v";
