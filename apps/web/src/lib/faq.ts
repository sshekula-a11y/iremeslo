/**
 * Časté otázky – jeden zdroj pro stránku Časté otázky, Pro řemeslníky, úvod i strukturovaná data.
 * Odpovědi smí slibovat jen to, co systém opravdu umí (a co říkají obchodní podmínky).
 */
export interface Faq { q: string; a: string; link?: { href: string; label: string } }

export const FAQ_CUSTOMERS: Faq[] = [
  { q: "Je zadání poptávky zdarma?", a: "Ano, vždy a bez registrace. Platí jen řemeslníci za aplikaci." },
  { q: "Jak rychle dostanu nabídky?", a: "Záleží na oboru a místě, konkrétní dobu proto neslibujeme. U poptávky uvidíte, kolik řemeslníků si zobrazilo váš kontakt." },
  {
    q: "Kdo uvidí můj kontakt?",
    a: "Popis, obec, PSČ, kraj a termín jsou veřejné. Jméno, telefon, e-mail a ulici vidí jen přihlášení řemeslníci s potvrzeným e-mailem a IČO ověřeným v ARES – každý nejvýše 50 nových kontaktů denně.",
    link: { href: "/ochrana-osobnich-udaju#poptavky", label: "Ochrana osobních údajů" },
  },
  { q: "Musím některou nabídku přijmout?", a: "Ne. Nic nepodepisujete a k ničemu se nezavazujete. Vybíráte si sami." },
  { q: "Jak poznám důvěryhodného řemeslníka?", a: "Kontakt na vás vidí jen firmy a živnostníci s IČO ověřeným v ARES. Přesto chtějte písemnou cenovou nabídku, reference a před zahájením smlouvu o dílo." },
  { q: "Jak poptávku uzavřu?", a: "Odkazem z e-mailu, kterým jste poptávku potvrdili. Poptávka zmizí ze seznamu a kontakt už nikdo další neuvidí." },
  { q: "Co když se nikdo neozve?", a: "Poptávka platí 60 dní. Zkuste doplnit popis nebo rozsah, případně ji zadat znovu." },
];

export const FAQ_TRADESMEN: Faq[] = [
  {
    q: "Jak získám nové zakázky?",
    a: "Procházejte poptávky, filtrujte podle oboru a kraje, zobrazte si kontakt a ozvěte se zákazníkovi. Kontakty vidí firmy s IČO ověřeným v ARES – ověření proběhne automaticky po zadání IČO.",
    link: { href: "/poptavky", label: "Poptávky" },
  },
  { q: "Kolik to stojí?", a: "30 dní zdarma, pak od 199 Kč měsíčně bez DPH. Všechny funkce jsou v každém tarifu.", link: { href: "/cenik", label: "Ceník" } },
  { q: "Co obsahuje bezplatné období?", a: "Všechny funkce bez omezení, bez platební karty. Platí jednou pro každé IČO a samo se nezmění v placené předplatné." },
  { q: "Funguje to na mobilu?", a: "Ano, v prohlížeči na telefonu i počítači. Na telefonu si aplikaci můžete přidat na plochu a otevírat jako aplikaci." },
  { q: "Jak fungují kalkulace?", a: "Zadáte práci, materiál, zaměstnance a výdaje. Aplikace spočítá cenu, náklady, výdělek i marži a upozorní, když marže klesne pod vaši hranici." },
  { q: "Mohu vystavovat faktury?", a: "Ano, pro plátce i neplátce DPH, včetně záloh, daňových dokladů k platbě a QR Platby. Fakturu vystavíte po potvrzení e-mailu." },
  { q: "Umí aplikace smlouvu o dílo?", a: "Ano. Ze zakázky vystavíte smlouvu o dílo s předmětem a cenou a zároveň vznikne předávací protokol. Logo, razítko a podpis se doplní z nastavení." },
  { q: "Hodí se i pro neplátce DPH?", a: "Ano. Při založení firmy zvolíte, jestli jste plátce. Doklady neplátce jsou bez DPH a obsahují text „Nejsem plátce DPH“." },
  { q: "Kdo uvidí moje čísla?", a: "Jen vaše firma. Data každé firmy jsou oddělená, pracovníci nevidí ceny ani zisk a databáze běží v EU (Frankfurt)." },
  { q: "Mohu předplatné kdykoli zrušit?", a: "Ano, e-mailem. Služba běží do konce zaplaceného období a potom máte ještě 30 dní na stažení dokladů a dat." },
];

/** Strukturovaná data FAQPage (schema.org). */
export function faqJsonLd(items: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
