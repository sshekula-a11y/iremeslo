import { OPERATOR } from "@/lib/operator";

/**
 * Texty veřejného webu, které se opakují na více stránkách (úvod, Pro řemeslníky, Jak to funguje).
 * Slibovat smí jen to, co aplikace opravdu umí.
 */

/** Co aplikace umí. */
export const FEATURES = [
  { title: "Nové zakázky", text: "Procházejte poptávky z vašeho oboru a kraje a ozvěte se zákazníkovi jako první." },
  { title: "Kalkulace", text: "Práce, materiál, lidé a výdaje. Hned vidíte cenu, náklady i marži." },
  { title: "Cenové nabídky", text: "Profesionální PDF s logem, razítkem a podpisem za pár minut." },
  { title: "Faktury", text: "Pro plátce i neplátce DPH, zálohy a QR Platba. Čísla dokladů jdou po sobě." },
  { title: "Smlouva o dílo", text: "Ze zakázky vystavíte smlouvu s předmětem a cenou. Předávací protokol vznikne s ní." },
  { title: "Kalendář a přehled", text: "Kdo, kde a kdy pracuje. Co čeká na platbu a kolik vyděláte na každé zakázce." },
];

/** Řemeslník: jak začít. */
export const TRADESMAN_STEPS = [
  { title: "Zaregistrujte se a zadejte IČO", text: "Údaje firmy načteme z ARES. IČO ověříme automaticky – pak uvidíte kontakty z poptávek." },
  { title: "Najděte vhodnou zakázku", text: "Filtrujte poptávky podle oboru, kraje a stáří a ozvěte se zákazníkovi." },
  { title: "Spočítejte a pošlete nabídku", text: "Zakázka spočítá cenu i marži, nabídku stáhnete jako PDF." },
  { title: "Naplánujte práci a vyfakturujte", text: "Termín v kalendáři, smlouva o dílo, předávací protokol a faktura s QR Platbou." },
];

/** Zákazník: od poptávky po výběr řemeslníka. */
export const CUSTOMER_STEPS = [
  { title: "Zadáte poptávku", text: "Popíšete práci, místo a termín. Zdarma a bez registrace; poptávku potvrdíte odkazem z e-mailu." },
  { title: "Poptávka se zobrazí řemeslníkům", text: "Je ve veřejném seznamu poptávek. Váš kontakt vidí jen řemeslníci s IČO ověřeným v ARES." },
  { title: "Řemeslníci se vám ozvou", text: "Zavolají nebo napíšou s nabídkou. U poptávky vidíte, kolik z nich si kontakt zobrazilo." },
  { title: "Vyberete a poptávku uzavřete", text: "Nic nepodepisujete. Až si vyberete, poptávku jedním kliknutím z e-mailu uzavřete." },
];

/** Komu svěřujete data. */
export const TRUST = [
  `Provozovatel ${OPERATOR.name}, IČO ${OPERATOR.ico}`,
  "Data v EU (Frankfurt), oddělená pro každou firmu",
  "Faktury a doklady podle zákona o DPH, číslované bez mezer",
  "Analytické a reklamní cookies jen s vaším souhlasem",
];
