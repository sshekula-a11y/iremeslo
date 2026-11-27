import { breadcrumbs, ldGraph } from "@/lib/seo";

/** Strukturovaná data stránky; `trail` = drobečková navigace bez úvodu, např. [["Ceník", "/cenik"]]. */
export function JsonLd({ trail, nodes = [] }: { trail?: [string, string][]; nodes?: object[] }) {
  const all = [...(trail ? [breadcrumbs(trail)] : []), ...nodes];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldGraph(...all).replace(/</g, "\\u003c") }} />;
}
