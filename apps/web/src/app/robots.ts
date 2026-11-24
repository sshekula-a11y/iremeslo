import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Vyhledávače: veřejný web ano, aplikace, administrace a odkazy z e-mailů ne. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/ssh", "/auth", "/overeni", "/poptavky/sprava", "/poptavky/odeslano", "/registrace-firmy", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
