/**
 * Stránky pro řemeslníky, kteří hledají program (vyhledávání typu „program pro instalatéry“).
 * Každá stránka má vlastní obsah. Slibovat smí jen to, co aplikace opravdu umí; ukázkové výpočty
 * počítá stejné jádro jako aplikace (@iremeslo/core) a jsou označené jako ilustrační.
 */
import type { Faq } from "@/lib/faq";

export interface LandingExample {
  title: string;
  /** částky v Kč, množství v jednotkách – na haléře se převedou při výpočtu */
  work: { description: string; qty: number; unit: string; unitPrice: number }[];
  materials: { description: string; qty: number; unit: string; purchasePrice: number; salePrice: number }[];
  labor: { name: string; qty: number; unit: "hod" | "den"; rate: number }[];
  expenses: { description: string; qty: number; unitPrice: number }[];
  vatMode: "standard" | "reverse_charge" | "non_payer";
  vatRate: 0 | 12 | 21;
  note: string;
}

export interface Landing {
  slug: string;
  /** krátký název do odkazů a drobečkové navigace */
  name: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  h1Accent: string;
  intro: string;
  pains: { title: string; text: string }[];
  features: { title: string; text: string }[];
  example?: LandingExample;
  shots: ("zakazka" | "nabidka" | "kalendar")[];
  faq: Faq[];
  /** kategorie poptávek pro odkaz „Poptávky z vašeho oboru“ */
  inquiryCategory?: string;
}

const BASE_FAQ: Faq[] = [
  { q: "Kolik to stojí?", a: "30 dní zdarma bez platební karty, pak od 199 Kč měsíčně bez DPH. Všechny funkce jsou v každém tarifu.", link: { href: "/cenik", label: "Ceník" } },
  { q: "Funguje to na mobilu?", a: "Ano, v prohlížeči na telefonu i počítači. Na telefonu si aplikaci přidáte na plochu a otevíráte jako aplikaci – nic se neinstaluje z obchodu." },
];

export const LANDINGS: Landing[] = [
  {
    slug: "program-pro-remeslniky",
    name: "Program pro řemeslníky",
    metaTitle: "Program pro řemeslníky – zakázky, kalkulace, faktury",
    metaDescription: "Zakázky s kalkulací a marží, nabídky, faktury, smlouvy o dílo s podpisem prstem a poptávky v jednom programu. 30 dní zdarma, pak od 199 Kč.",
    h1: "Program pro řemeslníky,",
    h1Accent: "který se vejde do telefonu",
    intro: "Od poptávky po zaplacenou fakturu na jednom místě. Spočítáte cenu i zisk, pošlete nabídku, zákazník podepíše smlouvu prstem a fakturu s QR Platbou vystavíte jedním klepnutím ze zakázky.",
    pains: [
      { title: "Papíry v autě a čísla v hlavě", text: "Kalkulace na papíře, faktury v jiném programu a termíny v telefonu. Při každé zakázce opisujete totéž znovu." },
      { title: "Nevíte, kolik jste vydělali", text: "Na konci měsíce je na účtu méně, než jste čekali – a nevíte, která zakázka se nevyplatila." },
      { title: "Administrativa po večerech", text: "Nabídky, smlouvy a faktury píšete po práci, místo abyste odpočívali." },
    ],
    features: [
      { title: "Zakázka s kalkulací", text: "Práce, materiál, lidé a výdaje. Hned vidíte cenu, náklady, výdělek a marži – a varování, když marže klesne pod vaši hranici." },
      { title: "Nabídka, smlouva, faktura", text: "Ze zakázky vystavíte nabídku v PDF, smlouvu o dílo s předávacím protokolem a fakturu. Nic se nepřepisuje." },
      { title: "Podpis prstem", text: "Zákazník podepíše na vašem telefonu, nebo na dálku přes odkaz z e-mailu či SMS. Podpis je v PDF s časem a otiskem dokladu." },
      { title: "Nové zakázky z poptávek", text: "Poptávky zákazníků z vašeho oboru a kraje, upozornění e-mailem a nabídka přímo v systému." },
      { title: "Ziskovost a daně", text: "Obrat, zisk a marže po měsících, výdaje z vyfocených účtenek a hlídání limitu DPH a termínů." },
      { title: "Pro vás i partu", text: "Zaměstnanci vidí své zakázky a termíny, ne ceny ani zisk. Kalendář ukáže, kdo kde dělá." },
    ],
    shots: ["zakazka", "nabidka", "kalendar"],
    faq: [
      ...BASE_FAQ,
      { q: "Pro jaké obory se hodí?", a: "Pro řemeslníky a menší stavební firmy – malíře, instalatéry, elektrikáře, obkladače, pokrývače, zedníky, zahradníky i úklidové firmy. Jednotky (m², bm, ks, hod…) a sazby si nastavíte sami." },
      { q: "Zvládnu to bez školení?", a: "Aplikace je postavená na tom, jak řemeslník pracuje: zakázka → nabídka → smlouva → faktura. Údaje firmy se načtou z ARES podle IČO." },
    ],
  },
  {
    slug: "fakturace-pro-remeslniky",
    name: "Fakturace pro řemeslníky",
    metaTitle: "Fakturace pro řemeslníky – faktura z telefonu s QR Platbou",
    metaDescription: "Faktury pro plátce i neplátce DPH, zálohy, přenesená daňová povinnost, QR Platba a export pro účetní (PDF + ISDOC). Vystavíte i z telefonu.",
    h1: "Fakturace pro řemeslníky",
    h1Accent: "přímo ze zakázky",
    intro: "Fakturu vystavíte ze zakázky jedním klepnutím – položky, zákazník i cena už tam jsou. Nebo rychle bez zakázky. QR Platba, čísla dokladů po sobě a pro účetní ZIP s PDF a ISDOC.",
    pains: [
      { title: "Opisování položek", text: "Cenu jste už spočítali v nabídce, a do faktury ji píšete znovu – a s ní i chyby." },
      { title: "Zákazník platí pozdě", text: "Nevíte, kdo dluží a jak dlouho, a upomínku píšete ručně." },
      { title: "Účetní chce doklady", text: "Každý měsíc posíláte faktury jednotlivě a hledáte, co chybí." },
    ],
    features: [
      { title: "Plátce i neplátce DPH", text: "Sazby 21 % a 12 %, přenesená daňová povinnost pro stavební práce a doklady neplátce s textem „Nejsem plátce DPH“." },
      { title: "Zálohy a vyúčtování", text: "Zálohová faktura, daňový doklad k přijaté platbě a opravný doklad. Čísla jdou po sobě bez mezer." },
      { title: "QR Platba", text: "Na faktuře je QR kód s částkou, účtem a variabilním symbolem – zákazník zaplatí z mobilu bez opisování." },
      { title: "Nezaplacené na očích", text: "Přehled faktur po splatnosti, upomínka a předžalobní výzva k neuhrazené faktuře." },
      { title: "Pro účetní", text: "Vydané faktury za období stáhnete jako ZIP s PDF a ISDOC, který načte většina účetních programů." },
      { title: "Přechod z jiného programu", text: "Faktury vystavené jinde (FakturaOnline, Fakturoid, iDoklad, Pohoda…) převezmete jako archiv s PDF; vaše číselná řada zůstane." },
    ],
    shots: ["nabidka", "zakazka"],
    faq: [
      ...BASE_FAQ,
      { q: "Umí přenesenou daňovou povinnost?", a: "Ano. U zakázky nebo faktury zvolíte režim přenesené daňové povinnosti – doklad je bez DPH a obsahuje povinný text, daň odvede odběratel." },
      { q: "Můžu fakturovat 12 % DPH za práce v bytě?", a: "Ano, u zakázky i faktury zvolíte sníženou sazbu 12 %. Zda se na vaši práci vztahuje, posuďte podle zákona o DPH nebo s účetní." },
      { q: "Kdy můžu vystavit první fakturu?", a: "Hned po potvrzení e-mailu. Údaje vaší firmy se při registraci načtou z ARES podle IČO." },
    ],
  },
  {
    slug: "evidence-zakazek",
    name: "Evidence zakázek",
    metaTitle: "Evidence zakázek pro řemeslníky a malé firmy",
    metaDescription: "Všechny zakázky na jednom místě: stav, zákazník, termín, kalkulace, doklady a podpisy. Kalendář pro celou partu. 30 dní zdarma.",
    h1: "Evidence zakázek",
    h1Accent: "od poptávky po zaplacení",
    intro: "Každá zakázka má svůj stav, zákazníka, místo, termín, kalkulaci a všechny doklady – nabídku, smlouvu, protokol i faktury. Víte, co čeká na nabídku, co se dělá a co ještě není zaplacené.",
    pains: [
      { title: "Kde co je", text: "Nabídka v e-mailu, smlouva v šuplíku, faktura v jiném programu. Dohledat historii zakázky trvá." },
      { title: "Kdo kde dělá", text: "Termíny se překrývají a parta neví, kam ráno jet." },
      { title: "Zapomenuté zakázky", text: "Poslaná nabídka bez odpovědi, dokončená práce bez faktury – peníze, které unikají." },
    ],
    features: [
      { title: "Stavy zakázky", text: "Poptávka → Nabídka odeslána → Schváleno → Probíhá → Dokončeno → Vyfakturováno → Zaplaceno. Na první pohled víte, co kde vázne." },
      { title: "Kalendář", text: "Měsíc na počítači, seznam po dnech na telefonu. Barvy podle stavu zakázky." },
      { title: "Doklady u zakázky", text: "Nabídka, smlouva o dílo, předávací protokol, dodací list se soupisem prací, dodatek, reklamace a faktury – vše z jedné zakázky." },
      { title: "Plán a skutečnost", text: "Po dokončení zapíšete skutečně spotřebovaný materiál a hodiny a uvidíte skutečný zisk." },
      { title: "Zaměstnanci", text: "Pracovník vidí své zakázky a termíny s adresou a mapou, ne ceny ani zisk." },
      { title: "Hledání", text: "Zákazníka, zakázku nebo doklad najdete podle jména, IČO, telefonu, obce nebo čísla dokladu." },
    ],
    shots: ["kalendar", "zakazka"],
    faq: [
      ...BASE_FAQ,
      { q: "Můžu převzít zákazníky z jiného programu?", a: "Ano. Kontakty načtete z vCard nebo Excelu a vyexportujete je stejně." },
      { q: "Vidí pracovník ceny?", a: "Ne. Pracovník vidí své zakázky, termíny a adresu. Ceny, náklady, zisk ani faktury nevidí." },
    ],
  },
  {
    slug: "kalkulace-zakazek",
    name: "Kalkulace zakázek",
    metaTitle: "Kalkulace zakázky s marží – program pro řemeslníky",
    metaDescription: "Spočítejte cenu zakázky z práce, materiálu, lidí a výdajů. Hned vidíte náklady, výdělek a marži; aplikace hlídá, když je marže nízká.",
    h1: "Kalkulace zakázky",
    h1Accent: "s marží na první pohled",
    intro: "Zadáte práci, materiál, lidi a výdaje a aplikace spočítá cenu pro zákazníka, náklady, výdělek a marži. Když marže klesne pod vaši hranici, upozorní vás – ještě než nabídku pošlete.",
    pains: [
      { title: "Cena od oka", text: "Cenu odhadnete podle minula. Že jste zapomněli na lešení nebo dopravu, zjistíte až na konci." },
      { title: "Materiál bez přirážky", text: "Materiál přeúčtujete za nákupní cenu a o přirážku přicházíte." },
      { title: "Lidé jsou náklad", text: "Hodiny party se do ceny nepromítnou správně a zakázka vyjde na nulu." },
    ],
    features: [
      { title: "Čtyři části nákladů", text: "Práce účtovaná zákazníkovi, materiál (nákup a prodej), lidé podle hodinové nebo denní sazby a výdaje jako doprava či plošina." },
      { title: "Přirážka na materiál", text: "Prodejní cena materiálu se předvyplní z nákupní ceny a vaší přirážky. Materiál zahrnutý v ceně práce označíte jako jen náklad." },
      { title: "Hlídání marže", text: "Nastavíte si minimální marži (třeba 15 %). Zakázka pod hranicí svítí na červeno." },
      { title: "Ceník prací a materiálu", text: "Opakované položky vyberete z vlastního ceníku – stejná cena pokaždé, bez hledání." },
      { title: "Plán vs. skutečnost", text: "Po dokončení zapíšete skutečnou spotřebu a uvidíte, jestli zakázka vydělala, co jste plánovali." },
      { title: "Ze sloupce do nabídky", text: "Hotovou kalkulaci pošlete jako nabídku v PDF s logem a razítkem jedním klepnutím." },
    ],
    example: {
      title: "Ukázka: nátěr střechy 180 m²",
      work: [{ description: "Čištění a nátěr střechy 2×", qty: 180, unit: "m²", unitPrice: 250 }],
      materials: [{ description: "Střešní barva", qty: 60, unit: "l", purchasePrice: 160, salePrice: 220 }],
      labor: [{ name: "2 pracovníci", qty: 6, unit: "den", rate: 2800 }],
      expenses: [{ description: "Doprava a plošina", qty: 1, unitPrice: 4200 }],
      vatMode: "standard", vatRate: 21,
      note: "Ilustrační čísla. Takhle aplikace spočítá cenu a výdělek z vašich sazeb.",
    },
    shots: ["zakazka", "nabidka"],
    faq: [
      ...BASE_FAQ,
      { q: "Jak se počítá marže?", a: "Marže = výdělek ÷ cena bez DPH. Výdělek je cena bez DPH minus náklady na materiál, lidi a výdaje. Počítá se v haléřích, bez zaokrouhlovacích chyb." },
      { q: "Můžu dát zákazníkovi slevu?", a: "Ano, procentem nebo částkou. Kalkulace hned ukáže, kolik vás sleva stojí na výdělku." },
    ],
  },
  {
    slug: "program-pro-instalatery",
    name: "Program pro instalatéry",
    metaTitle: "Program pro instalatéry a topenáře – zakázky a faktury",
    metaDescription: "Kalkulace výměny kotle nebo rozvodů, nabídka, předávací protokol s podpisem prstem a faktura s QR Platbou. Poptávky voda, topení, plyn.",
    h1: "Program pro instalatéry",
    h1Accent: "a topenáře",
    intro: "Výměna kotle, rozvody, koupelna. Spočítáte materiál s přirážkou i hodiny, zákazníkovi pošlete nabídku a po práci podepíše předávací protokol prstem na vašem telefonu. Faktura s QR Platbou je hotová ze zakázky.",
    pains: [
      { title: "Drahý materiál, tenká marže", text: "Kotel, čerpadlo, armatury – když přirážku nespočítáte správně, vyděláte jen na hodinách." },
      { title: "Rychlé výjezdy", text: "Havárie a drobné opravy: fakturu potřebujete hned na místě, ne večer." },
      { title: "Reklamace", text: "Zákazník se ozve po půl roce a vy hledáte, co a kdy jste dělali." },
    ],
    features: [
      { title: "Materiál s přirážkou", text: "Nákupní a prodejní cena každé položky, přirážka se předvyplní. Hned vidíte, kolik vyděláte na materiálu a kolik na práci." },
      { title: "Rychlá faktura", text: "Po výjezdu vystavíte fakturu z telefonu i bez zakázky – s QR Platbou, zákazník zaplatí hned." },
      { title: "Předávací protokol s podpisem", text: "Předání díla podepíše zákazník prstem; protokol i smlouva jsou v PDF u zakázky." },
      { title: "Reklamační protokol", text: "Reklamaci zapíšete k zakázce i s podpisem zákazníka. Historie zakázky je dohledatelná." },
      { title: "Sazba DPH 12 % i 21 %", text: "U prací v bytech a rodinných domech zvolíte sníženou sazbu, jinak základní – v zakázce i faktuře." },
      { title: "Poptávky voda, topení, plyn", text: "Poptávky zákazníků z vašeho kraje a upozornění e-mailem, jakmile nějaká přibude." },
    ],
    example: {
      title: "Ukázka: výměna plynového kotle",
      work: [{ description: "Demontáž a montáž kotle, napojení, zprovoznění", qty: 1, unit: "paušál", unitPrice: 9500 }],
      materials: [
        { description: "Kondenzační kotel", qty: 1, unit: "ks", purchasePrice: 38000, salePrice: 42500 },
        { description: "Odkouření a armatury", qty: 1, unit: "ks", purchasePrice: 6200, salePrice: 7400 },
      ],
      labor: [{ name: "Instalatér", qty: 9, unit: "hod", rate: 450 }],
      expenses: [{ description: "Doprava a odvoz starého kotle", qty: 1, unitPrice: 900 }],
      vatMode: "standard", vatRate: 12,
      note: "Ilustrační čísla. Snížená sazba 12 % jen tam, kde ji zákon o DPH dovoluje.",
    },
    shots: ["zakazka", "nabidka"],
    inquiryCategory: "instalace",
    faq: [
      ...BASE_FAQ,
      { q: "Můžu vystavit fakturu hned na místě?", a: "Ano. Rychlá faktura je na telefonu dostupná z tlačítka „+ Nový“, s QR Platbou pro okamžitou úhradu." },
      { q: "Najdu tu poptávky na topení a vodu?", a: "Ano, v oboru Voda, topení, plyn. Kontakt na zákazníka vidí jen firmy s IČO ověřeným v ARES." },
    ],
  },
  {
    slug: "program-pro-elektrikare",
    name: "Program pro elektrikáře",
    metaTitle: "Program pro elektrikáře – kalkulace, nabídky, faktury",
    metaDescription: "Elektroinstalace v kalkulaci po bm a kusech, nabídka v PDF, soupis prací, přenesená daňová povinnost pro subdodávky a faktura s QR Platbou.",
    h1: "Program pro elektrikáře",
    h1Accent: "od rozpočtu po fakturu",
    intro: "Kabely po metrech, krabice a zásuvky po kusech, hodiny montáže. Rozpočet elektroinstalace spočítáte v zakázce, pošlete nabídku a po dokončení vystavíte dodací list se soupisem prací a fakturu.",
    pains: [
      { title: "Desítky položek", text: "Rozpočet elektroinstalace má spoustu drobných položek – v tabulce se snadno ztratí." },
      { title: "Subdodávky pro stavební firmy", text: "U stavebních prací pro plátce platí přenesená daňová povinnost a faktura musí mít správný text." },
      { title: "Změny během práce", text: "Zákazník přidá zásuvky navíc a na konci se přete, co bylo v ceně." },
    ],
    features: [
      { title: "Položky po bm a kusech", text: "Jednotky bm, ks, hod i paušál. Opakované položky vyberete z vlastního ceníku prací a materiálu." },
      { title: "Přenesená daňová povinnost", text: "U zakázky zvolíte režim přenesení daňové povinnosti – faktura je bez DPH a s povinným textem." },
      { title: "Dodatek ke smlouvě", text: "Práce navíc zapíšete dodatkem ke smlouvě o dílo; zákazník ho podepíše prstem nebo přes odkaz." },
      { title: "Soupis provedených prací", text: "Dodací list se soupisem prací k předání nebo k fakturaci." },
      { title: "Lidé a hodiny", text: "Hodinové sazby pracovníků v nákladech zakázky, plán a skutečně odpracované hodiny." },
      { title: "Poptávky na elektroinstalace", text: "Poptávky zákazníků z oboru Elektroinstalace a upozornění e-mailem." },
    ],
    example: {
      title: "Ukázka: elektroinstalace bytu 2+kk",
      work: [
        { description: "Montáž kabeláže", qty: 180, unit: "bm", unitPrice: 85 },
        { description: "Krabice, zásuvky, vypínače – montáž", qty: 42, unit: "ks", unitPrice: 260 },
        { description: "Rozvaděč – zapojení", qty: 1, unit: "paušál", unitPrice: 6500 },
      ],
      materials: [
        { description: "Kabel CYKY", qty: 180, unit: "bm", purchasePrice: 24, salePrice: 30 },
        { description: "Přístroje a krabice", qty: 42, unit: "ks", purchasePrice: 120, salePrice: 150 },
        { description: "Rozvaděč s jističi", qty: 1, unit: "ks", purchasePrice: 5800, salePrice: 6900 },
      ],
      labor: [{ name: "2 elektrikáři", qty: 48, unit: "hod", rate: 420 }],
      expenses: [{ description: "Doprava", qty: 4, unitPrice: 350 }],
      vatMode: "standard", vatRate: 21,
      note: "Ilustrační čísla. Revizní zprávu aplikace nevystavuje – zapíšete ji jako položku práce.",
    },
    shots: ["zakazka", "nabidka"],
    inquiryCategory: "elektro",
    faq: [
      ...BASE_FAQ,
      { q: "Umí aplikace revizní zprávy?", a: "Ne, revizní zprávy aplikace nevystavuje. Revizi zapíšete jako položku práce a zprávu z revizního programu přiložíte zákazníkovi zvlášť." },
      { q: "Jak vyfakturuji subdodávku stavební firmě?", a: "V zakázce nebo faktuře zvolte přenesenou daňovou povinnost. Doklad bude bez DPH a s textem, že daň odvede odběratel." },
    ],
  },
  {
    slug: "program-pro-malire",
    name: "Program pro malíře",
    metaTitle: "Program pro malíře a natěrače – kalkulace po m² a faktury",
    metaDescription: "Kalkulace malování po m², barva s přirážkou, nabídka v PDF, smlouva a předávací protokol s podpisem prstem. Poptávky na malování z vašeho kraje.",
    h1: "Program pro malíře",
    h1Accent: "a natěrače",
    intro: "Výmalba bytu, fasáda, nátěr střechy. Plochu v m² vynásobíte sazbou, přidáte barvu s přirážkou a partu na dny – a hned vidíte, kolik na zakázce vyděláte. Nabídku pošlete z telefonu ještě na prohlídce.",
    pains: [
      { title: "Nabídka až večer", text: "Na prohlídce si zapíšete metry a nabídku posíláte až druhý den. Mezitím zákazník oslovil jiného." },
      { title: "Barva a lepicí pásky", text: "Drobný materiál se do ceny nepočítá a na velké zakázce je to znát." },
      { title: "Málo zakázek v sezóně", text: "Zakázky přicházejí nárazově a mimo sezónu chybí." },
    ],
    features: [
      { title: "Kalkulace po m²", text: "Práce po m² nebo bm, materiál s přirážkou, parta na hodiny nebo dny. Cena, výdělek a marže hned." },
      { title: "Nabídka z prohlídky", text: "Nabídku v PDF s logem pošlete zákazníkovi ještě na místě – z telefonu." },
      { title: "Smlouva a předání", text: "Smlouva o dílo a předávací protokol podepsané prstem, vše u zakázky." },
      { title: "Sazba 12 % u bytů", text: "U prací v bytech a rodinných domech zvolíte sníženou sazbu DPH, u ostatních základní." },
      { title: "Poptávky na malování", text: "Poptávky z oboru Malování a natěračství ve vašem kraji a upozornění e-mailem." },
      { title: "Ziskovost po měsících", text: "Které zakázky vydělaly nejvíc a kde byla marže nízká." },
    ],
    example: {
      title: "Ukázka: výmalba bytu 3+1",
      work: [
        { description: "Penetrace a výmalba stěn a stropů 2×", qty: 260, unit: "m²", unitPrice: 48 },
        { description: "Zakrytí, úklid", qty: 1, unit: "paušál", unitPrice: 1800 },
      ],
      materials: [
        { description: "Malířská barva a penetrace", qty: 14, unit: "kbel.", purchasePrice: 520, salePrice: 610 },
        { description: "Fólie, pásky, drobný materiál", qty: 1, unit: "bal.", purchasePrice: 650, salePrice: 780 },
      ],
      labor: [{ name: "2 malíři", qty: 4, unit: "den", rate: 2200 }],
      expenses: [{ description: "Doprava", qty: 4, unitPrice: 250 }],
      vatMode: "standard", vatRate: 12,
      note: "Ilustrační čísla. Snížená sazba 12 % jen tam, kde ji zákon o DPH dovoluje.",
    },
    shots: ["zakazka", "nabidka"],
    inquiryCategory: "malovani",
    faq: [
      ...BASE_FAQ,
      { q: "Najdu tu zakázky na malování?", a: "Ano. Zákazníci zadávají poptávky zdarma; v oboru Malování a natěračství je uvidíte podle kraje a můžete poslat nabídku přímo v systému." },
      { q: "Hodí se i pro malíře bez DPH?", a: "Ano. Neplátce DPH vystavuje doklady bez daně s textem „Nejsem plátce DPH“." },
    ],
  },
  {
    slug: "program-pro-stavebni-firmy",
    name: "Program pro stavební firmy",
    metaTitle: "Program pro malé stavební firmy – zakázky, smlouvy, ziskovost",
    metaDescription: "Zakázky s rozpočtem a marží, smlouva o dílo s dodatky, přenesená daňová povinnost, zálohy, více part v kalendáři a ziskovost po měsících.",
    h1: "Program pro malé",
    h1Accent: "stavební firmy",
    intro: "Rekonstrukce, zednické práce, subdodávky. Rozpočet s marží, smlouva o dílo s dodatky, zálohové faktury a přenesená daňová povinnost. Party v kalendáři a ziskovost zakázek po měsících.",
    pains: [
      { title: "Velké zakázky, velké riziko", text: "Na zakázce za stovky tisíc stačí podcenit materiál nebo hodiny a zisk je pryč." },
      { title: "Více part, jeden kalendář", text: "Kdo je kde a kdy se uvolní, víte jen vy – z hlavy." },
      { title: "Smlouvy a dodatky", text: "Změny během stavby se domlouvají ústně a při fakturaci se přete o vícepráce." },
    ],
    features: [
      { title: "Rozpočet s marží", text: "Práce, materiál, lidé a výdaje (lešení, kontejner, plošina). Hlídání minimální marže." },
      { title: "Smlouva o dílo a dodatky", text: "Smlouva s předmětem, cenou a termínem, předávací protokol a dodatky na vícepráce – s podpisem prstem nebo přes odkaz." },
      { title: "Přenesená daňová povinnost", text: "Pro stavební práce pro plátce DPH – doklady s povinným textem, daň odvede odběratel." },
      { title: "Zálohy", text: "Zálohová faktura, daňový doklad k přijaté platbě a vyúčtování." },
      { title: "Party a kalendář", text: "Zaměstnanci s vlastními sazbami a právy, kalendář zakázek pro celou firmu." },
      { title: "Ziskovost zakázek", text: "Obrat, náklady, zisk a marže po měsících; nejvýnosnější a nejslabší zakázky." },
    ],
    example: {
      title: "Ukázka: rekonstrukce koupelny",
      work: [
        { description: "Bourací práce a odvoz suti", qty: 1, unit: "paušál", unitPrice: 14000 },
        { description: "Obklady a dlažby", qty: 32, unit: "m²", unitPrice: 950 },
        { description: "Instalace a zednické přípomoce", qty: 1, unit: "paušál", unitPrice: 22000 },
      ],
      materials: [
        { description: "Obklady, dlažby, lepidla", qty: 35, unit: "m²", purchasePrice: 620, salePrice: 720 },
        { description: "Sanita a baterie", qty: 1, unit: "kpl", purchasePrice: 28000, salePrice: 32000 },
      ],
      labor: [{ name: "Parta 2 lidé", qty: 9, unit: "den", rate: 5200 }],
      expenses: [{ description: "Kontejner", qty: 1, unitPrice: 3800 }],
      vatMode: "standard", vatRate: 12,
      note: "Ilustrační čísla. Sazbu DPH volíte podle typu stavby a odběratele.",
    },
    shots: ["kalendar", "zakazka"],
    inquiryCategory: "zednicke",
    faq: [
      ...BASE_FAQ,
      { q: "Kolik uživatelů můžeme mít?", a: "Tarif Základní pro 1–5 uživatelů, Bez limitu pro neomezený počet. Pracovníci vidí jen své zakázky, ne ceny ani zisk.", link: { href: "/cenik", label: "Ceník" } },
      { q: "Umí aplikace rozpočet podle ceníkové soustavy?", a: "Ne, cenové soustavy typu ÚRS nenačítá. Rozpočet skládáte z vlastních položek a vlastního ceníku prací a materiálu." },
    ],
  },
];

export const getLanding = (slug: string) => LANDINGS.find((l) => l.slug === slug) ?? null;
