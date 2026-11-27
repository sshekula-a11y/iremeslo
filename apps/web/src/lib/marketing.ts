
/**
 * Texty veřejného webu, které se opakují na více stránkách (úvod, Pro řemeslníky, Jak to funguje).
 * Slibovat smí jen to, co aplikace opravdu umí.
 */

/** Co aplikace umí. */
export const FEATURES = [
  { title: "Nové zakázky", text: "Procházejte poptávky z vašeho oboru a kraje a ozvěte se zákazníkovi jako první." },
  { title: "Kalkulace", text: "Práce, materiál, lidé a výdaje. Hned vidíte cenu, náklady i marži." },
  { title: "Cenové nabídky", text: "Profesionální PDF s logem, razítkem a podpisem za pár minut." },
  { title: "Faktury", text: "Pro plátce i neplátce DPH, zálohy, QR Platba a ISDOC. Čísla dokladů jdou po sobě." },
  { title: "Smlouvy a listiny", text: "Smlouva o dílo, předávací protokol, dodací list se soupisem prací, reklamační protokol a dodatek ke smlouvě." },
  { title: "Podpis prstem", text: "Zákazník podepíše listinu na vašem telefonu, nebo na dálku přes odkaz z e-mailu či SMS. Podpis je v PDF." },
  { title: "Upomínky a pokladna", text: "Upomínka i předžalobní výzva k neuhrazené faktuře, příjmové a výdajové pokladní doklady s přehledem pokladny." },
  { title: "Pro účetní i přechod", text: "Faktury v ZIP (PDF + ISDOC) pro účetní. Faktury a kontakty převezmete z jiného programu (ZIP, vCard, Excel)." },
  { title: "Kalendář a přehled", text: "Kdo, kde a kdy pracuje. Co čeká na platbu a kolik vyděláte na každé zakázce." },
];

/** Řemeslník: jak začít. */
export const TRADESMAN_STEPS = [
  { title: "Zaregistrujte se a zadejte IČO", text: "Údaje firmy včetně zápisu v rejstříku načteme z ARES. IČO ověříme automaticky – pak uvidíte kontakty z poptávek." },
  { title: "Najděte vhodnou zakázku", text: "Filtrujte poptávky podle oboru, kraje a stáří a ozvěte se zákazníkovi." },
  { title: "Spočítejte a pošlete nabídku", text: "Zakázka spočítá cenu i marži, nabídku stáhnete jako PDF." },
  { title: "Naplánujte práci a vyfakturujte", text: "Termín v kalendáři, smlouva o dílo podepsaná prstem, předávací protokol a faktura s QR Platbou." },
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
  "Česká firma, podpora v češtině",
  "Data v EU (Frankfurt), oddělená pro každou firmu",
  "Faktury a doklady podle zákona o DPH, číslované bez mezer",
  "Analytické a reklamní cookies jen s vaším souhlasem",
];

/** Bezpečnost dat – jen ověřitelná fakta (stejná jako v zásadách ochrany osobních údajů). */
export const SECURITY = [
  { title: "Data v EU", text: "Databáze a soubory jsou v datovém centru ve Frankfurtu. Spojení je vždy šifrované (HTTPS), hesla ukládáme jen v zašifrované podobě." },
  { title: "Každá firma zvlášť", text: "Data firem od sebe odděluje přímo databáze. Že jedna firma nevidí data druhé, hlídá sada automatických testů." },
  { title: "Práva pro zaměstnance", text: "Pracovník v aplikaci vidí své zakázky a termíny, ne ceny ani zisk. Kdo bude mít jakou roli, určujete vy." },
  { title: "Do dat nenahlížíme", text: "Provozovatel do vašich zakázek a dokladů nenahlíží. Podporu poskytujeme jen na vaši žádost." },
  { title: "Data si kdykoli odnesete", text: "Faktury v ZIP (PDF + ISDOC) pro účetní, zákazníky do Excelu nebo vCard. Žádné uzamčení v programu." },
  { title: "Cookies jen se souhlasem", text: "Analytické a reklamní nástroje se načtou, jen když souhlasíte. Kontakty a obsah dokladů jim neposíláme." },
];
