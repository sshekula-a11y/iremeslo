# -*- coding: utf-8 -*-
"""Výchozí texty stránek profesí (/remeslnici/<slug>). Zdroj pravdy je potom tabulka public.professions –
texty jde upravovat a přidávat v administraci /ssh/profese. Ceny jen jako faktory, žádné částky."""
import json, sys

P = []
def add(slug, name, category, title, desc, intro, services, factors, tip, faq):
    P.append(dict(slug=slug, name=name, category=category, meta_title=title, meta_description=desc, intro=intro,
                  services=services, price_factors=factors, tip=tip, faq=[{"q": q, "a": a} for q, a in faq], sort=len(P) + 1))

add("instalater", "Instalatér", "instalace", "Instalatér – poptávka zdarma",
    "Hledáte instalatéra? Zadejte poptávku zdarma: rozvody vody a odpadů, koupelny, baterie, WC i opravy úniků. Ozvou se řemeslníci s ověřeným IČO.",
    "Instalatér se postará o všechno, co souvisí s vodou a odpady – od kapajícího kohoutku po kompletní rozvody v novostavbě. Popište v poptávce, co je potřeba, jak je byt nebo dům starý a jestli jde o havárii, nebo plánovanou práci. Čím přesnější popis a fotky stavu, tím rychleji dostanete reálnou nabídku.",
    ["Nové rozvody vody a odpadů při rekonstrukci", "Montáž a výměna baterií, umyvadel, WC a sprchových koutů",
     "Opravy úniků vody, ucpaných odpadů a protékajících splachovačů", "Připojení pračky, myčky a ohřívače vody",
     "Výměna stoupaček v bytových domech", "Tlakové zkoušky a předání nových rozvodů"],
    ["Rozsah – výměna jednoho prvku, nebo celé rozvody", "Materiál rozvodů (plast, měď, vícevrstvé potrubí) a zařizovací předměty",
     "Přístupnost – rozvody ve zdi, pod obkladem nebo v šachtě", "Nutnost bourání a následných zednických prací", "Spěch: havarijní výjezd mimo pracovní dobu"],
    "Při havárii nejdřív zavřete hlavní uzávěr vody. Do poptávky napište, kde uzávěr je a jestli funguje – instalatér tak hned ví, s čím počítat.",
    [("Kdo dodá materiál?", "Domluvte se předem. Někteří instalatéři materiál nakupují sami, jiní pracují s vaším. V nabídce chtějte materiál a práci zvlášť."),
     ("Mám chtít záruku?", "Ano. Na práci i materiál chtějte záruku písemně, ideálně ve smlouvě o dílo nebo na faktuře.")])

add("topenar", "Topenář", "instalace", "Topenář – výměna kotle a topení, poptávka zdarma",
    "Topenář na výměnu kotle, radiátorů nebo celé otopné soustavy. Zadejte poptávku zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Topenář navrhne, namontuje a seřídí vytápění – kotel, radiátory, podlahové topení i rozvody. Kvalitně zapojené a vyregulované topení šetří peníze každou zimu. V poptávce uveďte typ vytápění, velikost domu nebo bytu a co chcete změnit; pokud máte projekt nebo výpočet tepelných ztrát, zmiňte ho.",
    ["Výměna plynového kotle za kondenzační", "Montáž a výměna radiátorů a termostatických hlavic",
     "Podlahové vytápění a jeho regulace", "Nové rozvody topení při rekonstrukci",
     "Proplach a odvzdušnění otopné soustavy", "Napojení tepelného čerpadla nebo krbových kamen s výměníkem na soustavu"],
    ["Typ zdroje tepla a jeho výkon", "Počet radiátorů a délka rozvodů", "Stav stávající soustavy – zanesení, netěsnosti, staré potrubí",
     "Odkouření kotle a úpravy komína", "Regulace (termostaty, ekvitermní řízení)"],
    "Topení se nejlépe mění mimo topnou sezónu. Poptávku zadejte s předstihem – na podzim mají topenáři nejvíc práce.",
    [("Kdo uvede kotel do provozu?", "Obvykle servisní technik oprávněný výrobcem kotle. Zeptejte se, jestli to topenář zajistí, nebo s kým spolupracuje."),
     ("Potřebuji projekt?", "U výměny kotle za podobný často ne, u nové soustavy nebo změny zdroje tepla se projekt vyplatí. Topenář vám poradí.")])

add("plynar", "Plynař", "instalace", "Plynař – rozvody plynu a revize, poptávka zdarma",
    "Plynař na rozvody plynu, připojení sporáku nebo kotle a opravy netěsností. Poptávka zdarma, ozvou se řemeslníci s ověřeným IČO.",
    "Práce na plynu patří jen do rukou odborníka s oprávněním. Plynař vybuduje nebo upraví plynovou přípojku a rozvody, připojí spotřebiče a odstraní netěsnosti. Revizi plynového zařízení smí udělat jen revizní technik s platným osvědčením. V poptávce popište, o jaký spotřebič nebo úsek rozvodu jde a jestli máte předchozí revizní zprávu.",
    ["Nové rozvody plynu a jejich úpravy", "Připojení plynového sporáku, varné desky a kotle", "Hledání a oprava netěsností",
     "Tlakové zkoušky rozvodů", "Zajištění revize plynového zařízení", "Odpojení a zaslepení nepoužívaných spotřebičů"],
    ["Délka a vedení rozvodu", "Materiál potrubí", "Počet připojovaných spotřebičů", "Nutnost revize a tlakové zkoušky", "Přístupnost rozvodů"],
    "Cítíte plyn? Zavřete hlavní uzávěr, nepoužívejte elektrické spínače a volejte pohotovostní linku distributora plynu. Poptávka je pro plánované práce.",
    [("Jak často je potřeba revize?", "Lhůty určují předpisy a výrobce spotřebiče. Revizní technik vám termín další revize uvede ve zprávě."),
     ("Může plynař udělat i revizi?", "Jen pokud je zároveň revizním technikem s platným osvědčením. Zeptejte se ho na to v odpovědi na poptávku.")])

add("elektrikar", "Elektrikář", "elektro", "Elektrikář – elektroinstalace a revize, poptávka zdarma",
    "Elektrikář na novou elektroinstalaci, výměnu rozvaděče, zásuvky, osvětlení nebo revizi. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Elektrikář zapojí, opraví a zkontroluje elektroinstalaci v bytě, domě i firmě. Stará hliníková instalace, vypadávající jistič nebo plánovaná rekonstrukce – vždy se vyplatí odborník s oprávněním. Revizi smí provést jen revizní technik s platným osvědčením. Do poptávky napište stáří instalace, rozsah prací a jestli potřebujete revizní zprávu.",
    ["Nová elektroinstalace při rekonstrukci nebo stavbě", "Výměna rozvaděče a jističů, doplnění proudového chrániče",
     "Montáž zásuvek, vypínačů a osvětlení", "Přípojka pro sporák, myčku nebo nabíječku elektromobilu",
     "Hledání a odstranění poruch", "Revize elektroinstalace (revizní technik)"],
    ["Rozsah – jednotlivé okruhy, nebo celý byt či dům", "Sekání drážek a následné zednické práce", "Počet zásuvek, světel a okruhů",
     "Typ rozvaděče a jisticích prvků", "Potřeba revizní zprávy"],
    "Při rekonstrukci bytu dělejte elektroinstalaci dřív než omítky a obklady. Pozdější úpravy vycházejí dráž.",
    [("Kdy potřebuji revizi?", "Po nové instalaci nebo větší úpravě, při prodeji či pronájmu a pravidelně u firem. Revizní zprávu si uschovejte."),
     ("Musím vyměnit hliníkové vodiče?", "Není to vždy povinné, ale u staré instalace se to často doporučuje. Elektrikář posoudí stav na místě.")])

add("fotovoltaika", "Montér fotovoltaiky", "elektro", "Fotovoltaika – montáž solárních panelů, poptávka zdarma",
    "Montáž fotovoltaiky na rodinný dům nebo firmu: panely, střídač, baterie. Zadejte poptávku zdarma a porovnejte nabídky firem s ověřeným IČO.",
    "Fotovoltaická elektrárna snižuje účty za elektřinu, pokud je správně navržená na vaši spotřebu. Montážní firma posoudí střechu, navrhne výkon, střídač a případně baterii a postará se o zapojení. Připojení k distribuční soustavě schvaluje distributor. Do poptávky uveďte roční spotřebu elektřiny, typ a orientaci střechy a jestli chcete baterii.",
    ["Návrh výkonu podle vaší spotřeby", "Montáž panelů na šikmou i plochou střechu", "Střídač a bateriové úložiště",
     "Zapojení do domácí instalace a revize", "Vyřízení připojení u distributora", "Rozšíření stávající elektrárny"],
    ["Výkon elektrárny a počet panelů", "Typ a stav střechy, nosná konstrukce", "Baterie a její kapacita",
     "Délka kabelových tras a umístění střídače", "Administrativa a případná žádost o dotaci"],
    "Před montáží zkontrolujte stav střechy. Pokud ji budete za pár let opravovat, udělejte to raději před instalací panelů.",
    [("Vyplatí se baterie?", "Záleží na tom, kolik elektřiny spotřebujete přes den a večer. Chtějte od firmy výpočet pro obě varianty."),
     ("Pomůže firma s dotací?", "Některé firmy žádost o dotaci zajišťují. Podmínky programů se mění, proto si je ověřte aktuálně.")])

add("pokryvac", "Pokrývač", "strechy", "Pokrývač – střechy a klempířství, poptávka zdarma",
    "Pokrývač na novou střechu, výměnu krytiny nebo opravu zatékání. Zadejte poptávku zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Pokrývač pokládá a opravuje střešní krytinu – pálenou i betonovou tašku, plech, šindel či lepenku. Postará se o latě, fólie, větrání střechy a ve spolupráci s klempířem i o oplechování. Při zatékání pomůže najít příčinu, než se poškodí krov. V poptávce uveďte typ a sklon střechy, přibližnou plochu v m² a co je potřeba.",
    ["Pokládka nové krytiny", "Výměna staré krytiny včetně latí a fólie", "Opravy zatékání a poškozených tašek",
     "Střešní okna a výlezy", "Hřebeny, nároží a úžlabí", "Prohlídka střechy před koupí domu nebo po bouřce"],
    ["Plocha střechy v m² a její členitost", "Typ krytiny", "Sklon a výška – lešení nebo plošina", "Stav krovu a latí", "Odvoz a likvidace staré krytiny"],
    "Plochu střechy najdete v projektové dokumentaci. Pokud ji nemáte, uveďte půdorys domu a tvar střechy – pokrývač plochu dopočítá.",
    [("Kdy je nejlepší měnit střechu?", "Od jara do podzimu, kdy nemrzne a méně prší. Termíny se plní brzy, poptávku zadejte s předstihem."),
     ("Potřebuji stavební povolení?", "Výměna krytiny za podobnou ho většinou nepotřebuje, změna tvaru nebo výšky střechy ano. Ověřte si to na stavebním úřadě.")])

add("klempir", "Klempíř", "strechy", "Klempíř – okapy a oplechování, poptávka zdarma",
    "Klempíř na okapy, svody, oplechování komínů, atik a parapetů. Poptávka zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Klempíř zpracovává plech – okapy a svody, oplechování komínů, střešních prostupů, atik, říms a venkovních parapetů. Správně udělané klempířské prvky odvedou vodu od fasády a základů a prodlouží život střechy. Uveďte v poptávce délku okapů v metrech, materiál (pozink, titanzinek, měď, poplastovaný plech) a výšku domu.",
    ["Montáž a výměna okapů a svodů", "Oplechování komínů a střešních prostupů", "Oplechování atik, říms a zdí",
     "Venkovní parapety", "Opravy netěsných spojů a žlabů", "Lapače listí a sněhové zábrany"],
    ["Délka žlabů a svodů v metrech", "Materiál plechu", "Výška domu – lešení nebo plošina", "Počet komínů a prostupů", "Demontáž a odvoz starých prvků"],
    "Zatéká kolem komína? Často jde o oplechování, ne o krytinu. Napište to do poptávky – klempíř si vezme správný materiál.",
    [("Jaký plech vybrat?", "Pozink je nejlevnější, titanzinek a měď vydrží déle. Poplastovaný plech dostanete v barvě střechy."),
     ("Dělá klempíř i krytinu?", "Někteří klempíři jsou zároveň pokrývači. Pokud potřebujete obojí, napište to do poptávky.")])

add("tesar", "Tesař", "tesarske", "Tesař – krovy a dřevěné konstrukce, poptávka zdarma",
    "Tesař na krov, pergolu, přístřešek, dřevostavbu nebo opravu trámů. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Tesař staví a opravuje dřevěné nosné konstrukce – krovy, stropy, pergoly, přístřešky na auto, terasy i dřevostavby. Při rekonstrukci střechy posoudí stav trámů a vymění napadené nebo shnilé prvky. Do poptávky napište rozměry, účel stavby a jestli máte projekt nebo statický výpočet.",
    ["Nový krov a jeho úpravy", "Výměna a zesílení poškozených trámů", "Pergoly, altány a přístřešky na auto",
     "Dřevěné terasy a podlahy na terasu", "Dřevěné stropy a podkroví", "Ošetření dřeva proti škůdcům a hnilobě"],
    ["Rozměry a složitost konstrukce", "Druh a jakost dřeva", "Potřeba projektu nebo statika", "Doprava a jeřáb", "Stav stávající konstrukce"],
    "U pergoly nebo přístřešku si předem ověřte, jestli stavba nepotřebuje ohlášení stavebnímu úřadu.",
    [("Dodá tesař i krytinu?", "Některé firmy dělají krov i krytinu. Jinak se domluvte s pokrývačem, aby na sebe práce navazovaly."),
     ("Jaké dřevo vybrat?", "Pro konstrukce se nejčastěji používá smrk, venku často modřín nebo tepelně upravené dřevo. Tesař doporučí podle účelu.")])

add("truhlar", "Truhlář", "tesarske", "Truhlář – nábytek na míru, poptávka zdarma",
    "Truhlář na kuchyň, vestavěné skříně, schody, dveře nebo nábytek na míru. Poptávka zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Truhlář vyrobí nábytek přesně do vašeho prostoru – kuchyňskou linku, vestavěnou skříň, knihovnu, schodiště nebo interiérové dveře. Opravuje i starší dřevěné prvky. Do poptávky přidejte rozměry, materiál (masiv, dýha, lamino), představu o vzhledu a ideálně náčrt nebo fotku prostoru.",
    ["Kuchyňské linky na míru", "Vestavěné skříně a šatny", "Dřevěná schodiště a zábradlí",
     "Interiérové dveře a zárubně", "Renovace a opravy nábytku", "Obklady stěn a stropů ze dřeva"],
    ["Materiál – masiv, dýha, lamino, MDF", "Kování a spotřebiče", "Rozměry a složitost tvarů", "Povrchová úprava", "Doprava a montáž"],
    "Prostor zaměřte až po hotových podlahách a obkladech, nebo si nechte zaměřit truhlářem – ušetříte si nepříjemná překvapení.",
    [("Jak dlouho výroba trvá?", "Záleží na vytížení dílny a složitosti. Termín si nechte potvrdit v nabídce nebo ve smlouvě o dílo."),
     ("Mám chtít návrh?", "Ano, ideálně nákres s rozměry. Předejdete nedorozumění o vzhledu i ceně.")])

add("zednik", "Zedník", "zednicke", "Zedník – rekonstrukce a zednické práce, poptávka zdarma",
    "Zedník na zdění, omítky, příčky, bourání a drobné stavební úpravy. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Zedník zvládne většinu stavebních prací – zdění a bourání příček, omítky, betonování, zednické začištění po instalatérech a elektrikářích i drobné opravy. Často koordinuje rekonstrukci jako celek. Do poptávky napište rozsah v m² nebo bm, stáří domu a jestli jde o nosné konstrukce.",
    ["Zdění a bourání příček", "Vnitřní a venkovní omítky", "Betonování základů a podlah",
     "Zednické začištění po instalacích", "Opravy prasklin a vlhkého zdiva", "Drobné stavební úpravy a vybourání otvorů"],
    ["Rozsah v m² a druh práce", "Zásahy do nosných konstrukcí a statika", "Odvoz suti a kontejner", "Materiál", "Přístupnost – patro, výtah, parkování"],
    "Bourání nosné zdi nebo vybourání otvoru vždy konzultujte se statikem. Zedník vám obvykle doporučí, s kým spolupracuje.",
    [("Kdo zajistí kontejner na suť?", "Domluvte se v nabídce. Odvoz suti bývá samostatná položka."),
     ("Potřebuji ohlásit stavbu?", "U zásahu do nosných konstrukcí většinou ano. Informujte se na stavebním úřadě nebo u statika.")])

add("sadrokartonar", "Sádrokartonář", "zednicke", "Sádrokartonář – podhledy a příčky, poptávka zdarma",
    "Sádrokartonář na podhledy, příčky, předstěny a podkroví. Poptávka zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Sádrokarton je rychlá a čistá cesta k novým příčkám, sníženým stropům, předstěnám pro instalace i k obytnému podkroví. Sádrokartonář namontuje konstrukci, desky, izolaci a připraví povrch pro malíře. V poptávce uveďte plochu v m², výšku stropu a jestli jde o koupelnu (impregnované desky) nebo podkroví.",
    ["Podhledy a snížené stropy", "Příčky s izolací proti hluku", "Předstěny pro WC a instalace",
     "Obklad podkroví a půdní vestavby", "Protipožární konstrukce", "Tmelení a příprava pro malování"],
    ["Plocha v m²", "Typ desek – standardní, impregnované, protipožární", "Izolace a akustika", "Výška a tvary (oblouky, římsy)", "Kvalita tmelení"],
    "Myslete dopředu na zavěšené skříňky a televizi – do příčky se dávají výztuhy ještě před zaklopením.",
    [("Je sádrokarton do koupelny?", "Ano, impregnované desky do vlhkého prostředí. V místě sprchy se navíc dělá hydroizolace."),
     ("Jak rychle je hotovo?", "Příčka nebo podhled bývá hotový za pár dní včetně tmelení. Přesný termín uvede řemeslník.")])

add("rekonstrukce-bytu", "Rekonstrukce bytu a koupelny", "zednicke", "Rekonstrukce bytu a koupelny – poptávka zdarma",
    "Kompletní rekonstrukce bytu, koupelny nebo kuchyně na klíč. Zadejte poptávku zdarma a porovnejte nabídky firem s ověřeným IČO.",
    "Rekonstrukce bytu nebo koupelny spojuje více řemesel – bourání, instalace, elektro, omítky, obklady, podlahy a malování. Firma na klíč je zkoordinuje a za výsledek odpovídá jako celek. V poptávce popište rozsah (jen koupelna, nebo celý byt), plochu, stáří domu a termín, kdy se můžete vystěhovat.",
    ["Koupelna a WC na klíč", "Kompletní rekonstrukce bytu", "Výměna bytového jádra",
     "Nové rozvody vody, odpadů a elektřiny", "Podlahy, obklady a malování", "Koordinace řemesel a úklid po stavbě"],
    ["Rozsah a plocha", "Zásahy do instalací a nosných konstrukcí", "Standard materiálů a vybavení",
     "Pravidla domu – hlučné práce, výtah, skládka", "Délka rekonstrukce a koordinace řemesel"],
    "Před začátkem informujte správce domu a sousedy. Mnohé domy mají pravidla pro hlučné práce a odvoz suti.",
    [("Mám chtít smlouvu o dílo?", "Určitě. Má obsahovat rozsah, cenu, termín, platby a záruku. Usnadní řešení případných sporů."),
     ("Jak se platí?", "Obvykle záloha a doplatek po předání. Velké zálohy předem bez smlouvy nedoporučujeme.")])

add("malir", "Malíř pokojů", "malovani", "Malíř pokojů – výmalba bytu, poptávka zdarma",
    "Malíř na výmalbu bytu, domu nebo kanceláře, včetně oprav omítek a stěrek. Poptávka zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Malíř pokojů připraví povrch, opraví praskliny, zakryje podlahy a nábytek a stěny i stropy vymaluje. Kvalitní příprava je polovina výsledku. Do poptávky napište plochu v m² (nebo počet a velikost místností), výšku stropů a jestli se byt maluje vystěhovaný.",
    ["Výmalba bytů, domů a kanceláří", "Penetrace a opravy prasklin", "Stěrky a hlazení stěn",
     "Barevné malby a dekorativní techniky", "Malování po rekonstrukci", "Odstranění plísní a protiplísňové nátěry"],
    ["Plocha stěn a stropů v m²", "Stav podkladu a rozsah oprav", "Počet vrstev a barevnost", "Vystěhovaný, nebo zařízený byt", "Kvalita barvy"],
    "Pokud chcete barevné stěny, napište to do poptávky – sytější odstíny často potřebují víc vrstev.",
    [("Kdo kupuje barvu?", "Domluvte se. Malíř obvykle doporučí ověřenou barvu a nakoupí ji, v nabídce ale chtějte materiál zvlášť."),
     ("Jak dlouho výmalba trvá?", "Byt 2+1 bývá hotový za pár dní, podle oprav a schnutí. Termín si nechte potvrdit.")])

add("naterac", "Natěrač", "malovani", "Natěrač – nátěry fasád, oken a plotů, poptávka zdarma",
    "Natěrač na nátěry oken, dveří, plotů, střech, fasád a kovových konstrukcí. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Natěrač chrání a obnovuje dřevo, kov i omítky – okna, dveře, ploty, brány, plechové střechy, fasády a zábradlí. Nejdůležitější je příprava: odstranění starých vrstev, odrezení a správný základ. Do poptávky uveďte, co se natírá, přibližnou plochu nebo délku a materiál.",
    ["Nátěry dřevěných oken a dveří", "Nátěry plotů a bran", "Nátěry plechových střech",
     "Fasádní nátěry", "Odrezení a nátěry kovových konstrukcí", "Lazury a oleje na dřevo"],
    ["Plocha a členitost natíraných prvků", "Stav – loupající se barva, rez", "Druh nátěrového systému", "Výška a přístup", "Počet vrstev"],
    "Venkovní nátěry se dělají za sucha a při teplotách doporučených výrobcem barvy. Počítejte s tím při plánování termínu.",
    [("Jak často natírat?", "Záleží na materiálu a slunci. Dřevo na jižní straně potřebuje péči častěji."),
     ("Je nutné staré nátěry odstranit?", "Co se odlupuje, ano. Pevný starý nátěr často stačí přebrousit. Natěrač to posoudí.")])

add("fasadnik", "Fasádník", "fasady", "Fasádník – fasády a zateplení, poptávka zdarma",
    "Fasádník na zateplení domu, novou fasádu, omítky a opravy. Poptávka zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Fasádník zateplí dům kontaktním zateplovacím systémem, opraví nebo udělá novou omítku a postará se o detaily kolem oken, soklu a parapetů. Dobře provedené zateplení snižuje náklady na vytápění. Do poptávky napište plochu fasády v m², tloušťku a druh izolantu (pokud ho znáte) a výšku domu.",
    ["Zateplení fasády polystyrenem nebo minerální vlnou", "Nové fasádní omítky", "Opravy a sanace starých fasád",
     "Zateplení a úprava soklu", "Fasádní nátěry", "Montáž lešení"],
    ["Plocha fasády v m²", "Druh a tloušťka izolantu", "Lešení a výška domu", "Členitost – okna, balkony, rohy", "Stav podkladu"],
    "U zateplení se vyplatí hlídat detaily kolem oken a parapetů. Chtějte, aby nabídka uváděla použitý systém a tloušťku izolantu.",
    [("Kdy se zatepluje?", "Za vhodných teplot podle technického listu systému, obvykle od jara do podzimu."),
     ("Potřebuji povolení?", "Záleží na stavbě a lokalitě. Informujte se na stavebním úřadě, případně v SVJ.")])

add("obkladac", "Obkladač", "obklady", "Obkladač – obklady a dlažby, poptávka zdarma",
    "Obkladač na koupelny, kuchyně, terasy a velkoformátové dlažby. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Obkladač položí obklady a dlažby v koupelně, kuchyni, chodbě i na terase. Postará se o vyrovnání podkladu, hydroizolaci ve sprše a precizní spárování. Do poptávky uveďte plochu v m², formát obkladu (velké formáty jsou pracnější) a jestli je potřeba odstranit starý obklad.",
    ["Obklady a dlažby v koupelně a WC", "Kuchyňské zástěny", "Velkoformátové dlažby",
     "Dlažby na terasách a balkonech", "Hydroizolace sprchových koutů", "Opravy a přespárování"],
    ["Plocha v m²", "Formát a druh obkladu", "Stav podkladu a vyrovnání", "Bourání starého obkladu", "Lišty, rohy a řezání"],
    "Kupte obklad s rezervou kolem 10 % a ze stejné šarže – na pozdější opravy se hodí.",
    [("Kdo dodá obklad?", "Obvykle si ho vybíráte sami. Lepidla, hydroizolaci a spárovací hmotu často zajistí obkladač."),
     ("Kdy se může do sprchy?", "Až po vytvrdnutí lepidel a spárovací hmoty podle výrobce. Obkladač vám řekne přesnou dobu.")])

add("podlahar", "Podlahář", "podlahy", "Podlahář – pokládka a renovace podlah, poptávka zdarma",
    "Podlahář na pokládku vinylu, laminátu, dřevěných podlah a broušení parket. Poptávka zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Podlahář připraví podklad, položí novou podlahu a dokončí lišty a přechody. Umí i renovaci – broušení a lakování parket nebo olejování dřeva. Do poptávky napište plochu v m², druh podlahy a stav podkladu (beton, anhydrit, stará krytina).",
    ["Pokládka vinylu, laminátu a dřevěných podlah", "Broušení a lakování parket", "Vyrovnání a stěrkování podkladu",
     "Koberce a PVC", "Lišty a přechodové profily", "Opravy poškozených podlah"],
    ["Plocha v m²", "Druh podlahy a způsob pokládky", "Stav a rovinnost podkladu", "Odstranění staré krytiny", "Množství lišt a přechodů"],
    "Před pokládkou musí být podklad suchý. U nových potěrů změřte vlhkost – podlahář to obvykle udělá.",
    [("Plovoucí, nebo lepená podlaha?", "Lepená je tišší a stabilnější, plovoucí rychlejší. Podlahář doporučí podle podkladu a vytápění."),
     ("Jde to na podlahové topení?", "Většina materiálů ano, pokud to výrobce povoluje. Řekněte to podlaháři předem.")])

add("zahradnik", "Zahradník", "zahrada", "Zahradník – údržba a úprava zahrady, poptávka zdarma",
    "Zahradník na údržbu zahrady, sekání, prořez, výsadbu, trávník nebo zámkovou dlažbu. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Zahradník se postará o pravidelnou údržbu i o novou podobu zahrady – sekání trávy, stříhání živých plotů, prořez stromů, výsadbu, založení trávníku, zavlažování nebo terénní úpravy. Do poptávky uveďte velikost zahrady v m², co přesně chcete a jestli jde o jednorázovou práci, nebo pravidelnou péči.",
    ["Pravidelná údržba a sekání trávy", "Stříhání živých plotů a prořez stromů", "Založení trávníku a výsadba",
     "Automatické zavlažování", "Terénní úpravy a zámková dlažba", "Odvoz zeleného odpadu"],
    ["Velikost zahrady v m²", "Jednorázově, nebo pravidelně", "Výška stromů a přístup techniky", "Odvoz odpadu", "Rostliny a materiál"],
    "Kácení stromů může vyžadovat povolení obce. Zahradník vám poradí, co je potřeba.",
    [("Kdy prořezávat stromy?", "Záleží na druhu. Ovocné stromy se často řežou v zimě nebo předjaří, jiné v létě."),
     ("Dělá zahradník i dlažbu?", "Některé firmy ano. Napište to do poptávky, ať se ozvou ty správné.")])

add("uklid", "Úklid po stavbě a rekonstrukci", "uklid", "Úklid po stavbě a rekonstrukci – poptávka zdarma",
    "Úklid po stavbě, rekonstrukci nebo malování, mytí oken a pravidelný úklid. Poptávka zdarma a bez registrace, ozvou se firmy s ověřeným IČO.",
    "Po rekonstrukci zůstane prach všude – na podlahách, oknech, v kuchyňských skříňkách i na topení. Úklidová firma s profesionální technikou odstraní stavební prach, zbytky barev a lepidel a připraví prostor k bydlení. Do poptávky napište plochu, počet oken a jestli jde o úklid po stavbě, nebo pravidelný úklid.",
    ["Úklid po stavbě a rekonstrukci", "Mytí oken, rámů a parapetů", "Odstranění zbytků barev, malty a lepidel",
     "Úklid před nastěhováním a po vystěhování", "Pravidelný úklid domácností a kanceláří", "Čištění podlah a koberců"],
    ["Plocha a počet místností", "Počet a velikost oken", "Míra znečištění", "Úklidové prostředky a technika", "Termín – víkendy, noci"],
    "Objednejte úklid až po posledním řemeslníkovi. Jinak se platí dvakrát.",
    [("Přivezou si vlastní prostředky?", "Profesionální firmy obvykle ano. Pokud chcete ekologické prostředky, napište to."),
     ("Je potřeba moje přítomnost?", "Stačí předat klíče a ukázat, co se má uklidit. Domluvte se při přípravě.")])

add("zamecnik", "Zámečník", "jine", "Zámečník – zábradlí, brány a ploty, poptávka zdarma",
    "Zámečník na kovová zábradlí, brány, ploty, mříže, schodiště a svařování. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Zámečník vyrobí a namontuje kovové konstrukce na míru – zábradlí, brány a branky, ploty, mříže, schodiště, přístřešky nebo nosníky. Opraví i poškozené kovové prvky. Do poptávky uveďte rozměry, materiál (ocel, nerez, hliník), povrchovou úpravu a nejlépe nákres.",
    ["Zábradlí na schody, balkony a terasy", "Brány, branky a ploty", "Mříže a bezpečnostní prvky",
     "Kovová schodiště a konstrukce", "Svařování a opravy", "Pohony bran (ve spolupráci s elektrikářem)"],
    ["Rozměry a složitost", "Materiál – ocel, nerez, hliník", "Povrchová úprava – nátěr, zinkování, prášková barva", "Montáž a kotvení", "Doprava"],
    "U zábradlí si nechte poradit s výškou a mezerami – bezpečnost dětí je důležitější než vzhled.",
    [("Jak dlouho výroba trvá?", "Podle složitosti a povrchové úpravy, zinkování nebo prášková barva prodlužují termín."),
     ("Mám chtít návrh?", "Ano, nákres s rozměry předejde nedorozumění. Zámečník ho často připraví.")])

add("hodinovy-manzel", "Hodinový manžel", "jine", "Hodinový manžel – drobné opravy, poptávka zdarma",
    "Hodinový manžel na drobné opravy a montáže v domácnosti: police, nábytek, kapající kohoutek, lustry. Poptávka zdarma, ozvou se řemeslníci s ověřeným IČO.",
    "Hodinový manžel pomůže s drobnostmi, na které se nevyplatí volat specializovanou firmu – pověsí police a obrazy, smontuje nábytek, seřídí dveře, vymění těsnění nebo silikon. Do poptávky vypište všechny úkoly najednou; ušetříte za cestu a jeden výjezd stačí.",
    ["Montáž nábytku a polic", "Věšení obrazů, záclon a lustrů", "Seřízení dveří a oken",
     "Výměna silikonu a těsnění", "Drobné opravy v kuchyni a koupelně", "Drobné práce na zahradě"],
    ["Počet a druh úkolů", "Odhad času", "Cesta a doprava", "Drobný materiál", "Termín – víkendy a večery"],
    "Elektrické a plynové práce patří odborníkům s oprávněním. Hodinový manžel je smí dělat jen tehdy, když oprávnění má.",
    [("Jak se platí?", "Obvykle podle odpracovaného času nebo za jednotlivé úkoly. Domluvte se předem."),
     ("Přiveze si nářadí?", "Ano, běžné nářadí má sebou. Speciální materiál je dobré zmínit v poptávce.")])

add("cisteni-strech-fasad-dlazby", "Čištění střech, fasád a dlažeb", "cisteni", "Čištění střechy, fasády a dlažby – poptávka zdarma",
    "Čištění střechy od mechu, mytí fasády a čištění zámkové dlažby. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.",
    "Mech na střeše, zelené mapy na fasádě a tmavá dlažba nejsou jen estetický problém – zadržují vodu a zkracují životnost materiálu. Specializovaná firma vyčistí povrch šetrnou metodou, odstraní řasy a lišejníky a povrch ošetří ochranným prostředkem, aby se znečištění rychle nevrátilo. Do poptávky napište plochu v m², druh krytiny, fasády či dlažby a výšku domu.",
    ["Čištění střech od mechu a lišejníků", "Mytí a čištění fasád", "Čištění zámkové dlažby, teras a chodníků",
     "Biocidní a ochranné nátěry proti řasám", "Impregnace dlažby a betonu", "Čištění okapů a žlabů"],
    ["Plocha v m²", "Druh povrchu a míra znečištění", "Výška a přístup – plošina, horolezecká technika", "Metoda čištění a chemie", "Následná ochrana a impregnace"],
    "Ne každý povrch snese vysoký tlak vody. Zeptejte se, jakou metodu firma použije a jak chrání krytinu a fasádu před poškozením.",
    [("Jak často čistit?", "Podle polohy domu a stínu. Ochranný nátěr po čištění interval prodlouží."),
     ("Neponičí čištění střechu?", "Odborná firma volí šetrnou metodu podle krytiny. Chtějte popis postupu v nabídce.")])

add("renovace-exterieru", "Renovace exteriérů nemovitostí", "renovace", "Renovace exteriérů nemovitostí – poptávka zdarma",
    "Renovace exteriérů domu: obnova fasády, nátěry střech, plotů a teras, oprava soklu a venkovních schodů. Poptávka zdarma, ozvou se firmy s ověřeným IČO.",
    "Renovace exteriéru vrátí domu vzhled i ochranu – bez nákladné výměny. Firma obnoví fasádu, natře nebo zrenovuje střechu, opraví sokl, venkovní schody, terasy a ploty a sjednotí vzhled celé nemovitosti. Do poptávky popište, co chcete obnovit, přibližné plochy a stav jednotlivých částí; fotky pomůžou nejvíc.",
    ["Obnova a nátěry fasád", "Renovace a nátěry střech", "Opravy soklu a venkovních schodů",
     "Renovace teras, dlažeb a chodníků", "Nátěry a opravy plotů, bran a zábradlí", "Sjednocení vzhledu nemovitosti"],
    ["Rozsah a plochy jednotlivých částí", "Stav podkladů a potřeba oprav", "Typ nátěrů a materiálů", "Lešení, plošina a přístup", "Návaznost prací a počasí"],
    "Postupujte shora dolů: nejdřív střecha a okapy, pak fasáda, nakonec sokl, terasy a dlažby. Ušetříte za opakované čištění.",
    [("Vyplatí se renovace místo výměny?", "Pokud je podklad pevný, renovace bývá výrazně levnější. Firma stav posoudí na místě."),
     ("Kdy renovovat?", "Za suchého počasí a vhodných teplot, obvykle od jara do podzimu.")])

assert len(P) == 23, len(P)
json.dump(P, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print(len(P), "profesí; slov:", sum(len((p["intro"] + " ".join(p["services"]) + " ".join(p["price_factors"]) + p["tip"] + " ".join(f["q"] + f["a"] for f in p["faq"])).split()) for p in P) // len(P), "průměrně")
