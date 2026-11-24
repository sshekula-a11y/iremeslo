import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FaqList } from "@/components/FaqList";
import { FAQ_TRADESMEN } from "@/lib/faq";
import { CUSTOMER_STEPS } from "@/lib/marketing";

export const metadata: Metadata = {
  alternates: { canonical: "/jak-to-funguje" },
  title: "Jak to funguje",
  description: "Jak zadat poptávku zdarma a jak řemeslník za pár minut spočítá zakázku, pošle nabídku v PDF a naplánuje práci. Ukázky přímo z aplikace.",
};

interface Shot {
  src: string;
  alt: string;
  width: number;
  height: number;
  phone?: boolean;
  caption: string;
}

interface Step {
  id: string;
  title: string;
  lead: string;
  points: string[];
  shots: Shot[];
}

const STEPS: Step[] = [
  {
    id: "firma",
    title: "Založte firmu – stačí IČO",
    lead: "Zaregistrujete se e-mailem a zadáte IČO. Název, adresu, DIČ i to, jestli jste plátce DPH, načteme z ARES.",
    points: [
      "Hotovo za minutu, 30 dní zdarma, bez platební karty",
      "Funguje pro OSVČ i s.r.o., plátce i neplátce DPH",
      "Logo, razítko, podpis a účet doplníte v nastavení",
    ],
    shots: [{ src: "/jak-to-funguje/registrace-telefon.webp", alt: "Formulář založení firmy s údaji načtenými z ARES", width: 780, height: 1560, phone: true, caption: "Po zadání IČO se údaje vyplní samy." }],
  },
  {
    id: "zakazka",
    title: "Spočítejte zakázku přímo na stavbě",
    lead: "Zakázka má pět částí: práce, materiál, zaměstnanci, výdaje a souhrn. Souhrn se přepočítá s každým zadaným číslem.",
    points: [
      "Práce za m², bm, kus, hodinu nebo paušál",
      "Materiál s nákupní a prodejní cenou – prodejní se dopočítá z vaší přirážky",
      "Zaměstnanci a výdaje (plošina, doprava, skládka) jako náklad",
      "Hned vidíte výdělek a marži; když marže klesne pod vaši hranici, souhrn se zbarví červeně",
    ],
    shots: [
      { src: "/jak-to-funguje/zakazka-telefon.webp", alt: "Zakázka na telefonu: materiál a souhrn s náklady, výdělkem a marží", width: 780, height: 1688, phone: true, caption: "Na telefonu je souhrn přilepený dole." },
      { src: "/jak-to-funguje/zakazka-pocitac.webp", alt: "Zakázka na počítači: sekce prací a materiálu, vpravo souhrn", width: 1600, height: 1112, caption: "Na počítači je souhrn vpravo vedle formuláře." },
    ],
  },
  {
    id: "nabidka",
    title: "Vystavte cenovou nabídku v PDF",
    lead: "Jedním tlačítkem ze zakázky vznikne nabídka s vaším logem a číslem. PDF stáhnete do telefonu a pošlete zákazníkovi.",
    points: [
      "Zákazník vidí jen práce a materiál – nákupní ceny a náklady zůstanou u vás",
      "Rozpis DPH 12 i 21 %, texty pro neplátce i přenesenou daňovou povinnost",
      "Čísla nabídek jdou po sobě a vystavená nabídka se už nedá přepsat",
      "Čtyři barevné varianty, logo, razítko a podpis",
    ],
    shots: [{ src: "/jak-to-funguje/nabidka.webp", alt: "Cenová nabídka v PDF s dodavatelem, odběratelem, položkami a součtem s DPH", width: 1240, height: 1753, caption: "Takhle vypadá PDF, které dostane zákazník." }],
  },
  {
    id: "kalendar",
    title: "Naplánujte práci v kalendáři",
    lead: "Každá zakázka s termínem se ukáže v kalendáři. Barva ukazuje stav zakázky a u každé vidíte, kdo na ní pracuje.",
    points: [
      "Na počítači celý měsíc, na telefonu seznam dní od dneška",
      "Poptávka, nabídka, schváleno, probíhá, dokončeno – na první pohled",
      "Zakázky bez termínu nezapadnou, kalendář je připomene",
    ],
    shots: [
      { src: "/jak-to-funguje/kalendar-pocitac.webp", alt: "Měsíční kalendář zakázek s barvami podle stavu", width: 1600, height: 1112, caption: "Měsíc na počítači." },
      { src: "/jak-to-funguje/kalendar-telefon.webp", alt: "Kalendář na telefonu jako seznam dní se zakázkami", width: 780, height: 1688, phone: true, caption: "Na telefonu seznam po dnech." },
    ],
  },
];

const MORE = [
  { title: "Faktury a zálohy", text: "Fakturu vystavíte ze zakázky jedním tlačítkem: s QR Platbou, rekapitulací DPH a odečtem zaplacených záloh. Ke každé záloze se po zaplacení sám vystaví daňový doklad." },
  { title: "Přehled plateb", text: "Kolik vám dluží a co je po splatnosti, vidíte hned na přehledu. Zaplacenou fakturu označíte jedním klepnutím." },
  { title: "Ceník", text: "Uložte si práce a materiál, které děláte nejčastěji. V zakázce začnete psát název a cena s jednotkou se doplní." },
  { title: "Zákazníci a zaměstnanci", text: "Adresář zákazníků a vaši zaměstnanci s hodinovou a denní sazbou, ze které se počítají náklady zakázky." },
  { title: "Pracovníci v terénu", text: "Pracovník vidí jen zakázky, na kterých pracuje: adresu, termín a telefon na zákazníka. Ceny ani zisk ne." },
];

const SOON = [
  "Odeslání nabídky e-mailem a schválení nabídky zákazníkem jedním kliknutím",
  "Pozvánky pro kolegy do kanceláře a pracovníky",
];

const FAQ_PICK = ["Kolik to stojí?", "Funguje to na mobilu?", "Hodí se i pro neplátce DPH?", "Kdo uvidí moje čísla?"];

export default function HowItWorksPage() {
  return (
    <main>
      <SiteHeader current="jak-to-funguje" />

      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-12 pt-10">
          <h1 className="max-w-2xl font-display text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-[42px]">
            Jak to funguje
          </h1>
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Pro koho">
            <a href="#zakaznik" className="btn bg-white text-ink hover:bg-white/90">Pro zákazníky</a>
            <a href="#remeslnik" className="btn bg-accent text-ink hover:bg-[#f07400]">Pro řemeslníky</a>
          </nav>
        </div>
      </header>

      <section id="zakaznik" className="scroll-mt-4 border-b border-line bg-white" aria-labelledby="zakaznik-title">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <p className="text-[13px] font-bold uppercase tracking-wider text-accent-ink">Pro zákazníky</p>
          <h2 id="zakaznik-title" className="mt-1 font-display text-[26px] font-extrabold leading-tight sm:text-[30px]">Hledáte řemeslníka? Čtyři kroky a bez registrace</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CUSTOMER_STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl bg-paper p-5">
                <span className="num flex size-8 items-center justify-center rounded-full bg-accent font-bold text-ink" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-3 font-display text-[17px] font-bold leading-snug">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/poptavky/nova" className="btn-primary">Zadat poptávku zdarma</Link>
            <Link href="/caste-otazky#zakaznici" className="font-semibold text-accent-ink underline">Časté otázky zákazníků →</Link>
          </div>
        </div>
      </section>

      <section id="remeslnik" className="scroll-mt-4 bg-ink text-white" aria-labelledby="remeslnik-title">
        <div className="mx-auto max-w-5xl px-5 pb-10 pt-12">
          <p className="text-[13px] font-bold uppercase tracking-wider text-accent">Pro řemeslníky</p>
          <h2 id="remeslnik-title" className="mt-1 max-w-2xl font-display text-[26px] font-extrabold leading-tight sm:text-[30px]">
            Od poptávky po nabídku ve čtyřech krocích
          </h2>
          <p className="mt-3 max-w-xl text-[17px] text-white/75">
            Ukázky pocházejí přímo z aplikace, s vymyšlenou zakázkou na nátěr střechy.
          </p>
          <ol className="mt-6 flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-3.5 text-[14px] font-semibold hover:bg-white/15">
                  <span className="num flex size-6 items-center justify-center rounded-full bg-accent text-[13px] text-ink">{i + 1}</span>
                  {s.title.split(" – ")[0]}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-5 py-12 sm:space-y-20">
        {STEPS.map((s, i) => {
          // Telefon + počítač: text nahoře a snímky pod ním, ať je snímek z počítače dost velký.
          const wide = s.shots.length > 1;
          return (
          <section key={s.id} id={s.id} className="scroll-mt-6" aria-labelledby={`${s.id}-title`}>
            <div className={wide ? "grid gap-8" : `grid items-start gap-6 lg:grid-cols-2 lg:gap-10 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div className={wide ? "max-w-2xl" : "lg:sticky lg:top-6"}>
                <p className="num mb-2 text-[13px] font-bold uppercase tracking-wider text-accent-ink">Krok {i + 1}</p>
                <h2 id={`${s.id}-title`} className="font-display text-[26px] font-extrabold leading-tight sm:text-[30px]">{s.title}</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-muted">{s.lead}</p>
                <ul className="mt-4 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px]">
                      <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-[12px] font-bold text-ok" aria-hidden="true">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`grid gap-6 ${wide ? "md:grid-cols-[17rem_1fr] md:items-start md:gap-8" : ""}`}>
                {orderShots(s.shots).map((shot) => <Screenshot key={shot.src} shot={shot} />)}
              </div>
            </div>
          </section>
          );
        })}

        <section aria-labelledby="dalsi">
          <h2 id="dalsi" className="mb-4 font-display text-[24px] font-extrabold">A navíc</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MORE.map((m) => (
              <div key={m.title} className="card p-5">
                <h3 className="font-display text-[18px] font-bold">{m.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{m.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card border-dashed p-5 sm:p-6" aria-labelledby="pripravujeme">
          <h2 id="pripravujeme" className="font-display text-[20px] font-extrabold">
            Připravujeme <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-[12px] font-semibold text-accent-ink">brzy v aplikaci</span>
          </h2>
          <ul className="mt-3 space-y-1.5 text-[15px] text-muted">
            {SOON.map((x) => <li key={x} className="flex gap-2"><span aria-hidden="true">•</span>{x}</li>)}
          </ul>
        </section>

        <section aria-labelledby="otazky">
          <h2 id="otazky" className="mb-4 font-display text-[24px] font-extrabold">Časté otázky</h2>
          <FaqList items={FAQ_TRADESMEN.filter((f) => FAQ_PICK.includes(f.q))} />
          <Link href="/caste-otazky" className="mt-3 inline-block font-semibold text-accent-ink underline">Všechny časté otázky →</Link>
        </section>
      </div>

      <section className="bg-ink text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-10">
          <div>
            <h2 className="font-display text-[24px] font-extrabold">Vyzkoušejte to na své první zakázce</h2>
            <p className="mt-1 text-white/75">30 dní zdarma, bez platební karty.</p>
          </div>
          <Link href="/prihlaseni?rezim=registrace" className="btn-primary">Vyzkoušet zdarma</Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

/** Telefon vlevo (úzký), počítač vpravo – tak se dva snímky vejdou vedle sebe. */
function orderShots(shots: Shot[]): Shot[] {
  return [...shots].sort((a, b) => Number(!!b.phone) - Number(!!a.phone));
}

function Screenshot({ shot }: { shot: Shot }) {
  return (
    <figure className={shot.phone ? "mx-auto w-full max-w-[17rem]" : "w-full"}>
      <div className={shot.phone
        ? "overflow-hidden rounded-[2rem] border-[6px] border-ink bg-white shadow-[0_18px_40px_rgba(5,38,76,0.18)]"
        : "overflow-hidden rounded-xl border border-line bg-white shadow-[0_18px_40px_rgba(5,38,76,0.12)]"}>
        <Image src={shot.src} alt={shot.alt} width={shot.width} height={shot.height}
          sizes={shot.phone ? "272px" : "(min-width: 1024px) 700px, 100vw"} className="h-auto w-full" />
      </div>
      <figcaption className="mt-2 text-center text-[13px] text-muted">{shot.caption}</figcaption>
    </figure>
  );
}
