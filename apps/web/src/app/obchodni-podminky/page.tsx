import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { OPERATOR } from "@/lib/operator";
import { TERMS_VALID_FROM, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Obchodní podmínky",
  description: "Všeobecné obchodní podmínky platformy iRemeslo.cz: registrace, zkušební období, předplatné, odpovědnost, data a ukončení smlouvy.",
};

const VALID_FROM = TERMS_VALID_FROM;
const VERSION = TERMS_VERSION;

/**
 * Všeobecné obchodní podmínky (VOP) podle § 1751 a násl. zákona č. 89/2012 Sb., občanský zákoník.
 * Smlouva se uzavírá jen s podnikateli (registrace vyžaduje IČO), proto se neuplatní ustanovení o spotřebitelských smlouvách.
 * Text odpovídá tomu, jak platforma funguje: zkušební období 30 dní jednou na IČO, po skončení předplatného
 * režim jen pro čtení (migrace 007), zpracování údajů zákazníků uživatele (čl. 28 GDPR).
 * Ověřeno proti znění OZ § 435, 1751–1753, 1826, 2898 (zakonyprolidi.cz) a GDPR čl. 28 (eur-lex.europa.eu), 11/2026.
 */
export default function TermsPage() {
  return (
    <main>
      <SiteHeader />
      <article className="mx-auto max-w-3xl space-y-8 px-5 py-10 text-[16px] leading-relaxed">
        <header>
          <h1 className="font-display text-[32px] font-extrabold leading-tight">Všeobecné obchodní podmínky</h1>
          <p className="mt-2 text-muted">Platformy iRemeslo.cz · verze {VERSION}, účinné od {VALID_FROM}.</p>
        </header>

        <Part n={1} title="Úvodní ustanovení">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Tyto všeobecné obchodní podmínky (dále jen „<strong>podmínky</strong>“) upravují práva a povinnosti mezi
              provozovatelem platformy iRemeslo.cz, společností <strong>{OPERATOR.name}</strong>, IČO {OPERATOR.ico},
              DIČ {OPERATOR.dic}, se sídlem {OPERATOR.address} (dále jen „<strong>provozovatel</strong>“), a uživatelem
              platformy (dále jen „<strong>uživatel</strong>“).
            </li>
            <li>
              <strong>Platformou</strong> se rozumí webová aplikace dostupná na adrese iremeslo.cz, která slouží
              k evidenci zakázek, výpočtu nákladů a zisku, vystavování cenových nabídek, faktur a souvisejících dokladů
              (dále jen „<strong>služba</strong>“).
            </li>
            <li>
              Služba je určena výhradně <strong>podnikatelům</strong> (fyzickým i právnickým osobám) pro účely jejich
              podnikatelské činnosti. Uživatel registrací potvrzuje, že službu užívá jako podnikatel. Ustanovení
              občanského zákoníku o ochraně spotřebitele se proto na smlouvu nepoužijí.
            </li>
            <li>
              Kontakt na provozovatele: <a className="font-semibold text-accent-ink underline" href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
            </li>
          </ol>
        </Part>

        <Part n={2} title="Uzavření smlouvy a uživatelský účet">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Smlouva o užívání služby (dále jen „<strong>smlouva</strong>“) vzniká dokončením registrace, tedy
              vytvořením uživatelského účtu a vyjádřením souhlasu s těmito podmínkami. Smlouva se uzavírá na dobu neurčitou.
            </li>
            <li>
              Smlouva se uzavírá elektronicky v <strong>českém jazyce</strong>. Registrace probíhá v těchto krocích: zadání
              e-mailu a hesla, zaškrtnutí souhlasu s těmito podmínkami, potvrzení tlačítkem „Vytvořit účet zdarma“ a zadání
              IČO firmy. Před odesláním může uživatel zadané údaje zkontrolovat a opravit; údaje firmy může kdykoli změnit
              v nastavení aplikace.
            </li>
            <li>
              Provozovatel smlouvu archivuje: ukládá znění těchto podmínek a údaj o tom, kdy a s jakou verzí uživatel vyjádřil
              souhlas. Aktuální znění podmínek je trvale dostupné na této stránce; dřívější znění provozovatel na žádost zašle.
            </li>
            <li>
              Uživatel je povinen uvádět pravdivé, úplné a aktuální údaje, zejména e-mail, IČO, DIČ a další údaje
              o své firmě. Provozovatel může údaje ověřit ve veřejných rejstřících (ARES).
            </li>
            <li>
              Uživatel je povinen potvrdit svou e-mailovou adresu. Do jejího potvrzení může provozovatel omezit
              některé funkce služby, zejména vystavování faktur.
            </li>
            <li>
              Uživatel odpovídá za utajení svých přihlašovacích údajů a za veškerou činnost provedenou z jeho účtu.
              Podezření na zneužití účtu je povinen neprodleně oznámit provozovateli.
            </li>
            <li>
              Uživatel s rolí majitele může do své firmy přizvat další osoby (kolegy, pracovníky). Za jejich činnost
              ve službě odpovídá, jako by jednal sám.
            </li>
          </ol>
        </Part>

        <Part n={3} title="Zkušební období">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Po založení firmy získává uživatel <strong>bezplatné zkušební období v délce 30 dní</strong>. Zkušební období
              nevyžaduje zadání platební karty a po jeho skončení se automaticky nemění v placené předplatné.
            </li>
            <li>
              Zkušební období lze využít <strong>pouze jednou pro každé IČO</strong>, a to i v případě nové registrace
              s jinou e-mailovou adresou.
            </li>
            <li>
              Po skončení zkušebního období bez sjednaného předplatného přejde účet do <strong>režimu jen pro čtení</strong>:
              uživatel vidí všechna svá data a může stahovat vystavené doklady, nemůže však vytvářet nové zakázky ani doklady.
            </li>
          </ol>
        </Part>

        <Part n={4} title="Předplatné a platební podmínky">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Užívání služby po skončení zkušebního období je zpoplatněno formou <strong>předplatného</strong> na měsíční
              nebo roční období. Aktuální cena je uvedena v aplikaci nebo ji provozovatel sdělí uživateli před uzavřením
              předplatného. Ceny jsou uváděny bez DPH, k ceně se připočte DPH v zákonné výši.
            </li>
            <li>
              Předplatné se hradí předem, na základě faktury vystavené provozovatelem, bankovním převodem.
              Uživatel souhlasí se zasíláním faktur v elektronické podobě na e-mail uvedený v účtu.
            </li>
            <li>
              Pokud uživatel předplatné řádně a včas neuhradí, poskytuje mu provozovatel <strong>lhůtu 7 dní</strong> po
              skončení předplaceného období. Po jejím marném uplynutí přejde účet do režimu jen pro čtení podle čl. 3 odst. 3.
              Po zaplacení se plný přístup obnoví.
            </li>
            <li>
              Uhrazené předplatné se při předčasném ukončení smlouvy ze strany uživatele nevrací, nestanoví-li tyto
              podmínky jinak.
            </li>
            <li>
              Provozovatel je oprávněn cenu předplatného změnit. Změnu oznámí uživateli e-mailem nejméně 30 dní předem;
              nová cena se uplatní až od následujícího předplaceného období.
            </li>
          </ol>
        </Part>

        <Part n={5} title="Práva a povinnosti uživatele">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Uživatel je oprávněn užívat službu v rozsahu jejích aktuálních funkcí a v souladu s těmito podmínkami.</li>
            <li>
              Uživatel <strong>odpovídá za obsah všech dokladů</strong>, které ve službě vytvoří a vystaví, zejména za
              správnost údajů o odběrateli, cen, sazeb DPH, data uskutečnění zdanitelného plnění a za splnění svých
              daňových a účetních povinností. Služba je technický nástroj a <strong>nenahrazuje daňové ani účetní poradenství</strong>.
            </li>
            <li>
              Uživatel nesmí službu užívat v rozporu s právními předpisy, zejména k vystavování fiktivních dokladů,
              ani zasahovat do jejího technického fungování, obcházet její zabezpečení, získávat přístup k datům jiných
              uživatelů nebo službu nadměrně zatěžovat automatizovanými dotazy.
            </li>
            <li>
              Uživatel odpovídá za to, že má právo do služby vložit osobní údaje svých zákazníků a zaměstnanců
              a obrázky (logo, razítko, podpis), a že tím neporušuje práva třetích osob.
            </li>
          </ol>
        </Part>

        <Part n={6} title="Povinnosti provozovatele a dostupnost služby">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Provozovatel vynaloží úsilí, které lze rozumně požadovat, aby služba byla dostupná nepřetržitě. Nezaručuje
              však její nepřerušenou a bezchybnou dostupnost, zejména z důvodu údržby, aktualizací, výpadků poskytovatelů
              infrastruktury nebo okolností mimo jeho kontrolu.
            </li>
            <li>Plánovanou údržbu, která by výrazně omezila užívání služby, oznámí provozovatel předem, je-li to možné.</li>
            <li>
              Provozovatel je oprávněn službu průběžně rozvíjet, měnit a doplňovat její funkce. Podstatné omezení funkcí,
              za které uživatel platí, oznámí nejméně 30 dní předem.
            </li>
            <li>
              Provozovatel zajišťuje pravidelné zálohování dat. Uživateli doporučuje průběžně si ukládat vystavené doklady
              ve formátu PDF i mimo službu.
            </li>
          </ol>
        </Part>

        <Part n={7} title="Data uživatele a ochrana osobních údajů">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Data, která uživatel do služby vloží (zakázky, zákazníci, zaměstnanci, ceník, doklady), zůstávají
              <strong> ve vlastnictví uživatele</strong>. Provozovatel je používá výhradně k poskytování služby.
            </li>
            <li>
              Zpracování osobních údajů uživatele jako správce popisují{" "}
              <Link href="/ochrana-osobnich-udaju" className="font-semibold text-accent-ink underline">Zásady ochrany osobních údajů</Link>.
            </li>
            <li>
              Ve vztahu k osobním údajům, které uživatel do služby vloží, je uživatel <strong>správcem</strong> a provozovatel
              <strong>zpracovatelem</strong> podle čl. 28 nařízení Evropského parlamentu a Rady (EU) 2016/679 (GDPR).
              Odstavce 4 až 6 tohoto článku tvoří <strong>smlouvu o zpracování osobních údajů</strong>.
            </li>
            <li>
              <strong>Předmět, doba, povaha a účel zpracování:</strong> provozovatel osobní údaje ukládá, zobrazuje,
              zálohuje a zpracovává do podoby dokladů výhradně za účelem poskytování služby, a to po dobu trvání smlouvy
              a lhůty podle čl. 9 odst. 4. <strong>Kategorie subjektů údajů:</strong> zákazníci (odběratelé) uživatele
              a jejich kontaktní osoby, zaměstnanci a spolupracovníci uživatele. <strong>Typy osobních údajů:</strong>
              jméno a příjmení, adresa, IČO a DIČ, telefon, e-mail, údaje o zakázkách a dokladech, u zaměstnanců
              nákladové sazby a přiřazení k zakázkám. Uživatel do služby nevkládá zvláštní kategorie osobních údajů
              (čl. 9 GDPR).
            </li>
            <li>
              Provozovatel jako zpracovatel:
              <ol className="mt-2 list-[lower-alpha] space-y-1 pl-5">
                <li>
                  zpracovává osobní údaje pouze na základě doložených pokynů uživatele, kterými jsou tato smlouva a nastavení
                  a používání služby uživatelem, včetně předávání do třetích zemí; ukládá-li mu zpracování právní předpis,
                  informuje o tom uživatele předem, ledaže to předpis zakazuje;
                </li>
                <li>zajistí, aby se osoby oprávněné zpracovávat osobní údaje zavázaly k mlčenlivosti nebo aby se na ně vztahovala zákonná povinnost mlčenlivosti;</li>
                <li>
                  přijme opatření podle čl. 32 GDPR, zejména šifrované spojení, oddělení dat jednotlivých firem na úrovni
                  databáze, řízení přístupových oprávnění, zálohování a záznam zásahů do dat;
                </li>
                <li>
                  zapojuje další zpracovatele na základě <strong>obecného písemného povolení</strong>, které mu uživatel
                  uzavřením smlouvy uděluje; jejich aktuální seznam je uveden v{" "}
                  <Link href="/ochrana-osobnich-udaju" className="text-accent-ink underline">Zásadách ochrany osobních údajů</Link>.
                  O zamýšlené změně dalších zpracovatelů informuje uživatele e-mailem nejméně 30 dní předem; uživatel může
                  proti změně vznést námitku a v takovém případě smlouvu vypovědět ke dni účinnosti změny. Dalším zpracovatelům
                  ukládá stejné povinnosti na ochranu údajů, jaké má sám podle této smlouvy, a za jejich plnění odpovídá;
                </li>
                <li>je uživateli nápomocen vhodnými technickými a organizačními opatřeními při vyřizování žádostí subjektů údajů o výkon jejich práv;</li>
                <li>
                  je uživateli nápomocen při plnění povinností podle čl. 32 až 36 GDPR a porušení zabezpečení osobních údajů
                  mu oznámí bez zbytečného odkladu, nejpozději do 48 hodin od jeho zjištění;
                </li>
                <li>
                  po skončení smlouvy osobní údaje podle rozhodnutí uživatele <strong>vrátí</strong> (export dat) nebo
                  <strong> vymaže</strong>, a to včetně existujících kopií, nejpozději ve lhůtě podle čl. 9 odst. 4,
                  ledaže právní předpis vyžaduje jejich uložení;
                </li>
                <li>
                  poskytne uživateli informace potřebné k doložení splnění těchto povinností a umožní audity, včetně inspekcí,
                  prováděné uživatelem nebo auditorem, kterého uživatel pověří, po předchozím oznámení nejméně 14 dní předem
                  a tak, aby nebyla ohrožena bezpečnost ani data jiných uživatelů.
                </li>
              </ol>
            </li>
            <li>
              Provozovatel uživatele neprodleně upozorní, pokud by podle jeho názoru určitý pokyn porušoval GDPR nebo jiné
              předpisy o ochraně osobních údajů. Uživatel odpovídá za to, že má k předání osobních údajů provozovateli
              právní titul a že subjekty údajů řádně informoval.
            </li>
            <li>
              Provozovatel do dat uživatele nenahlíží. Výjimkou je technická podpora na žádost uživatele, řešení
              bezpečnostního incidentu nebo povinnost uložená právním předpisem; každý takový zásah zaznamenává.
            </li>
          </ol>
        </Part>

        <Part n={8} title="Odpovědnost a její omezení">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Uživatel registrací <strong>výslovně přijímá</strong> ustanovení tohoto článku (§ 1753 občanského zákoníku).
            </li>
            <li>
              Provozovatel neodpovídá za škodu vzniklou nesprávným nebo neúplným zadáním údajů uživatelem, nesprávným
              použitím služby, za obsah dokladů vystavených uživatelem ani za jejich daňové a účetní důsledky.
            </li>
            <li>
              Provozovatel neodpovídá za nepřesnost údajů převzatých z veřejných rejstříků (ARES) ani za dočasnou
              nedostupnost služby podle čl. 6 odst. 1.
            </li>
            <li>
              Celková odpovědnost provozovatele za škodu vzniklou uživateli v souvislosti se službou je omezena
              <strong> výší předplatného, které uživatel provozovateli skutečně zaplatil za posledních 12 měsíců</strong>
              před vznikem škody. Provozovatel neodpovídá za ušlý zisk ani za nepřímé škody.
            </li>
            <li>
              Omezení podle tohoto článku se neuplatní v rozsahu, v jakém je vylučuje § 2898 občanského zákoníku, zejména
              u újmy způsobené člověku na jeho přirozených právech a u újmy způsobené úmyslně nebo z hrubé nedbalosti.
            </li>
          </ol>
        </Part>

        <Part n={9} title="Doba trvání a ukončení smlouvy">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Uživatel může smlouvu kdykoli vypovědět e-mailem zaslaným na {OPERATOR.email} z adresy uvedené v účtu.
              Smlouva skončí uplynutím aktuálně předplaceného období, nebo okamžitě, pokud uživatel předplatné nemá.
            </li>
            <li>Provozovatel může smlouvu vypovědět bez udání důvodu s výpovědní dobou 30 dní.</li>
            <li>
              Provozovatel může s okamžitou účinností omezit přístup k účtu nebo smlouvu ukončit, pokud uživatel
              podstatně porušuje tyto podmínky, zejména čl. 5 odst. 3, nebo je v prodlení s úhradou předplatného
              déle než 60 dní.
            </li>
            <li>
              Po skončení smlouvy má uživatel ještě <strong>30 dní</strong> na stažení svých dokladů a dat; na žádost mu je
              provozovatel předá v běžném strojově čitelném formátu. Poté provozovatel data smaže, nejpozději do 90 dní
              od skončení smlouvy, s výjimkou údajů, které musí uchovávat podle právních předpisů.
            </li>
          </ol>
        </Part>

        <Part n={10} title="Změna podmínek">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Provozovatel může tyto podmínky v přiměřeném rozsahu měnit (§ 1752 občanského zákoníku), zejména z důvodu
              změny právních předpisů, rozvoje služby nebo bezpečnosti.
            </li>
            <li>
              Změnu oznámí uživateli e-mailem a v aplikaci <strong>nejméně 30 dní</strong> před její účinností. Pokud
              uživatel se změnou nesouhlasí, může smlouvu vypovědět ke dni účinnosti změny; v takovém případě mu provozovatel
              vrátí poměrnou část předplatného za nevyužité období. Pokračováním v užívání služby po účinnosti změny
              uživatel se změnou souhlasí.
            </li>
          </ol>
        </Part>

        <Part n={11} title="Závěrečná ustanovení">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Smlouva a tyto podmínky se řídí právním řádem České republiky, zejména občanským zákoníkem.</li>
            <li>Případné spory budou řešit věcně a místně příslušné soudy České republiky podle sídla provozovatele.</li>
            <li>
              Pokud se některé ustanovení podmínek ukáže jako neplatné nebo neúčinné, ostatní ustanovení tím nejsou dotčena.
            </li>
            <li>
              Komunikace mezi stranami probíhá elektronicky, zejména e-mailem na adresy uvedené v účtu uživatele
              a na {OPERATOR.email}.
            </li>
            <li>Tyto podmínky nabývají účinnosti dne {VALID_FROM}.</li>
          </ol>
        </Part>

        <p className="border-t border-line pt-6 text-[14px] text-muted">
          <Link href="/ochrana-osobnich-udaju" className="text-accent-ink underline">Ochrana osobních údajů</Link>
          {" · "}
          <Link href="/" className="text-accent-ink underline">Zpět na úvod</Link>
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}

function Part({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={`cl-${n}`}>
      <h2 id={`cl-${n}`} className="font-display text-[22px] font-extrabold">
        <span className="num text-muted">Čl. {n}</span> {title}
      </h2>
      {children}
    </section>
  );
}
