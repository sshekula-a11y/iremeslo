/**
 * Strukturovaná data pro vyhledávače (schema.org). Jen fakta, která na webu opravdu jsou –
 * žádná hodnocení ani počty zákazníků, dokud nejsou skutečné.
 */
import { OPERATOR } from "@/lib/operator";
import { PLANS } from "@/lib/pricing";
import { SITE_URL } from "@/lib/site";

export const ORG_ID = `${SITE_URL}/#org`;

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "iRemeslo.cz",
  legalName: OPERATOR.name,
  url: SITE_URL,
  logo: `${SITE_URL}/brand/logo.png`,
  vatID: OPERATOR.dic,
  address: { "@type": "PostalAddress", streetAddress: "Hybernská 1007/20", postalCode: "110 00", addressLocality: "Praha", addressCountry: "CZ" },
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: `${SITE_URL}/kontakt`, availableLanguage: "cs" },
};

/** Aplikace pro řemeslníky s cenami tarifů (bez DPH). */
export const SOFTWARE_APP = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: "iRemeslo.cz",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS",
  inLanguage: "cs",
  url: SITE_URL,
  description: "Program pro řemeslníky: zakázky s kalkulací a marží, cenové nabídky, faktury, smlouvy o dílo s podpisem prstem a veřejné poptávky.",
  publisher: { "@id": ORG_ID },
  offers: PLANS.filter((p) => p.month).map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: String(p.month),
    priceCurrency: "CZK",
    url: `${SITE_URL}/cenik`,
    priceSpecification: { "@type": "UnitPriceSpecification", price: String(p.month), priceCurrency: "CZK", unitCode: "MON", valueAddedTaxIncluded: false },
  })),
};

/** Drobečková navigace: [["Ceník", "/cenik"], …] – úvod se přidá sám. */
export function breadcrumbs(items: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["iRemeslo.cz", "/"] as [string, string], ...items].map(([name, path], i) => ({
      "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${path}`,
    })),
  };
}

export function ldGraph(...nodes: object[]) {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
}
